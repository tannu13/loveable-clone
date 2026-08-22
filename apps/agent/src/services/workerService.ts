import {
  getLifecycleWorkerQueueName,
  getMessageToAgentQueueName,
  QnAReplySchema,
  ReadFileRequestSchema,
  RedisMessageSchema,
  type TLifeCycleWorkerComms,
  type TRedisMessageSchema,
} from "@repo/shared";
import type { RedisClientType } from "redis";
import env from "../env";
import type { Harness } from "./agentServices/harness";
import {
  listProjectFiles,
  readProjectFile,
} from "./agentServices/projectFiles";
import { resolveResponse } from "./comms";
import type { ResponseLifeCycle } from "./responseHandler";
import { s3Service } from "./s3Service";

export class WorkerService {
  private subscriber: RedisClientType;
  private publisher: RedisClientType;
  private harness: Harness;
  private responseHandler: ResponseLifeCycle;
  private workspace: string;
  private isListeningForMessages = true;
  private harnessChain = Promise.resolve();

  constructor({
    subscriber,
    publisher,
    harness,
    responseHandler,
    workspace,
  }: {
    subscriber: RedisClientType;
    publisher: RedisClientType;
    harness: Harness;
    responseHandler: ResponseLifeCycle;
    workspace: string;
  }) {
    this.subscriber = subscriber;
    this.publisher = publisher;
    this.harness = harness;
    this.responseHandler = responseHandler;
    this.workspace = workspace;
  }

  async listenForJobs() {
    while (this.isListeningForMessages) {
      let response;
      try {
        response = await this.subscriber.brPop(
          getMessageToAgentQueueName(env.CONVERSATION_ID),
          0,
        );
      } catch (err) {
        if (!this.isListeningForMessages) break;
        console.error("Job queue read failed", err);
        continue;
      }

      if (!response) continue;

      try {
        const parsedElement = JSON.parse(response.element);
        const parsed = RedisMessageSchema.safeParse(parsedElement);
        if (!parsed.success) {
          console.error("Redis message payload invalid", parsed.error);
          continue;
        }

        this.dispatch(parsed.data);
      } catch (err) {
        console.error("Failed to parse payload", err);
      }
    }
  }

  private dispatch(job: TRedisMessageSchema) {
    if (
      job.type === "list_files" ||
      job.type === "read_file" ||
      job.type === "qna"
    ) {
      this.handleImmediateJob(job).catch((err: unknown) => {
        console.error("Immediate job failed", err);
      });
      return;
    }

    // anything that drives the harness or snapshots the workspace runs one at a time
    this.harnessChain = this.harnessChain
      .then(() => this.handleHarnessJob(job))
      .catch((err: unknown) => {
        console.error("Harness job failed", err);
      });
  }

  // jobs that must not queue behind the harness.
  private async handleImmediateJob(job: TRedisMessageSchema) {
    if (job.type === "list_files") {
      await this.handleListFiles();
    } else if (job.type === "read_file") {
      await this.handleReadFile(job.message);
    } else if (job.type === "qna") {
      const result = QnAReplySchema.safeParse(job.message);
      if (result.success) {
        resolveResponse(result.data.correlationId, result.data.answers);
      }
    }
  }

  private async handleHarnessJob(job: TRedisMessageSchema) {
    if (job.type === "text" && typeof job.message === "string") {
      this.harness.addUserPrompt(job.message);
      await this.harness.executeTask();
    } else if (job.type === "initiate_shutdown") {
      await this.handleShutdownInitiation();
    }
  }

  // "list_files"/"read_file" are deterministic workspace reads, handled
  // directly here rather than routed through the LLM harness.
  private async handleListFiles() {
    try {
      const files = await listProjectFiles(this.workspace);
      await this.responseHandler.send("file_list", { files });
    } catch (error) {
      await this.responseHandler.send("workspace_error", {
        message:
          error instanceof Error ? error.message : "Failed to list files",
      });
    }
  }

  private async handleReadFile(message: unknown) {
    const result = ReadFileRequestSchema.safeParse(message);
    if (!result.success) return;

    const { path } = result.data;

    try {
      const content = await readProjectFile(this.workspace, path);
      await this.responseHandler.send("file_content", { path, content });
    } catch (error) {
      await this.responseHandler.send("workspace_error", {
        path,
        message: error instanceof Error ? error.message : "Failed to read file",
      });
    }
  }

  private async handleShutdownInitiation() {
    try {
      // push backup to an object store - use S3Service
      const timestamp = Date.now();
      const fileName = `conversations/${env.CONVERSATION_ID}/backups/${timestamp}.tar.gz`;
      await s3Service.uploadAppBackupToS3(fileName);

      // td::record backup information somewhere

      // send to lifecycle service via queue - ready for shutdown
      const message: TLifeCycleWorkerComms = {
        type: "shutdown_ready",
        conversationId: env.CONVERSATION_ID,
      };
      await this.publisher.lPush(
        getLifecycleWorkerQueueName(),
        JSON.stringify(message),
      );

      // the draining phase should be done as the last step because the agent might fail at backing up the user app to s3
      // stop listening in for other messages - draining
      this.isListeningForMessages = false;
      this.subscriber.destroy();

      // park the process via an awaited promise
      await this.parkProcess();
    } catch (err) {
      console.error("Shutdown Failed...", err);
    }
  }

  private async parkProcess() {
    return new Promise(() => {
      process.on("SIGTERM", () => {
        console.log("Received SIGTERM from Kubernetes, shutting down cleanly.");
        process.exit(0);
      });

      process.on("SIGINT", () => {
        process.exit(0);
      });
    });
  }
}
