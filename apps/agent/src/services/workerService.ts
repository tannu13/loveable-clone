import {
  QnAReplySchema,
  ReadFileRequestSchema,
  RedisMessageSchema,
  type TRedisMessageSchema,
} from "@repo/shared";
import type { RedisClientType } from "redis";
import env from "../env";
import type { Harness } from "./agentServices/harness";
import { listProjectFiles, readProjectFile } from "./agentServices/projectFiles";
import { resolveResponse } from "./comms";
import type { ResponseLifeCycle } from "./responseHandler";

export class WorkerService {
  private subscriber: RedisClientType;
  private harness: Harness;
  private responseHandler: ResponseLifeCycle;
  private workspace: string;

  constructor({
    subscriber,
    harness,
    responseHandler,
    workspace,
  }: {
    subscriber: RedisClientType;
    harness: Harness;
    responseHandler: ResponseLifeCycle;
    workspace: string;
  }) {
    this.subscriber = subscriber;
    this.harness = harness;
    this.responseHandler = responseHandler;
    this.workspace = workspace;
  }

  async listenForJobs() {
    while (true) {
      const response = await this.subscriber.brPop(
        `convo-request-${env.CONVERSATION_ID}`,
        0,
      );
      if (!response) continue;

      try {
        const parsedElement = JSON.parse(response.element);
        const parsed = RedisMessageSchema.safeParse(parsedElement);
        if (!parsed.success) {
          console.error("Redis message payload invalid", parsed.error);
          continue;
        }

        this.handleJob(parsed.data);
      } catch (err) {
        console.error("Failed to parse payload", err);
      }
    }
  }

  async handleJob(jobData: TRedisMessageSchema) {
    if (jobData.type === "text" && typeof jobData.message === "string") {
      this.harness.addUserPrompt(jobData.message);
      await this.harness.executeTask();
    } else if (jobData.type === "qna") {
      const result = QnAReplySchema.safeParse(jobData.message);
      if (result.success) {
        resolveResponse(result.data.correlationId, result.data.answers);
      }
    } else if (jobData.type === "list_files") {
      await this.handleListFiles();
    } else if (jobData.type === "read_file") {
      await this.handleReadFile(jobData.message);
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
        message: error instanceof Error ? error.message : "Failed to list files",
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
}
