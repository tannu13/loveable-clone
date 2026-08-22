import { fork } from "node:child_process";
import path from "node:path";
import { checkFileExists } from "../utils/helpers";
import type { TAgentStatus, TSubAgentResponse } from "../types";

const SUBAGENT_BOOT_FILE_PATH = path.resolve(
  import.meta.dirname,
  "../subAgent.ts",
);
export class SubAgentOrchestrator {
  private maxDepth = 5;
  private parentId: string;
  private queue: Map<
    string,
    {
      status: TAgentStatus;
      systemPrompt: string;
      taskDescription: string;
      artifactPath: string;
      logs: string;
    }
  > = new Map();
  private resolver: ((value: TSubAgentResponse[]) => void) | undefined;

  constructor(parentId: string) {
    this.parentId = parentId;
  }

  private async areAllDone() {
    const hasUnfinished = Array.from(this.queue.values()).some(
      (agent) => agent.status === "PENDING" || agent.status === "IN_PROGRESS",
    );
    if (hasUnfinished || !this.resolver) return false;

    const response: TSubAgentResponse[] = [];
    for (const [agentId, agent] of this.queue.entries()) {
      let artifactContent = agent.logs;
      if (
        agent.artifactPath !== "" &&
        (await checkFileExists(agent.artifactPath))
      ) {
        artifactContent = await Bun.file(agent.artifactPath).text();
      }

      response.push({
        agentId,
        status: agent.status,
        artifactContent,
        taskDescription: agent.taskDescription,
        logs: agent.logs,
      });
    }

    // all agents are done by either completing or failing
    this.resolver(response);
  }

  addAgent({
    agentId,
    systemPrompt,
    taskDescription,
  }: {
    agentId: string;
    systemPrompt: string;
    taskDescription: string;
  }) {
    this.queue.set(agentId, {
      status: "PENDING",
      systemPrompt,
      taskDescription,
      artifactPath: "",
      logs: "",
    });
  }

  taskFinished(agentId: string, artifactPath: string, logs: string) {
    const task = this.queue.get(agentId);
    if (!task) return;

    task.status = "COMPLETED";
    task.artifactPath = artifactPath;
    task.logs = logs;

    void this.areAllDone();
  }

  taskFailed(agentId: string, artifactPath: string, logs: string) {
    const task = this.queue.get(agentId);
    if (!task) return;

    task.status = "FAILED";
    task.artifactPath = artifactPath;
    task.logs = logs;

    void this.areAllDone();
  }

  async spawnAgents() {
    // td:: spawn the agents in the queue with an extra tool call which allows them to submit result back to main, so that task finished / failed can be called
    if (!(await checkFileExists(SUBAGENT_BOOT_FILE_PATH))) {
      throw new Error(
        "Unable to find sub agent boot file: `subAgent.ts`. The initialization script to spawn subAgents cannot be found.",
      );
    }
    if (this.queue.size === 0) {
      throw new Error("No sub agents added before calling spawnAgents");
    }
    const awaitedPromise = new Promise<TSubAgentResponse[]>((res) => {
      this.resolver = res;
    });
    for (const [agentId, agent] of this.queue.entries()) {
      agent.status = "IN_PROGRESS";
      const { systemPrompt, taskDescription } = agent;
      // fork
      const child = fork(
        SUBAGENT_BOOT_FILE_PATH,
        [agentId, systemPrompt, taskDescription],
        {
          stdio: ["inherit", "inherit", "pipe", "ipc"],
        },
      );

      let isHandled = false;
      let childErrorLogs = "";

      // capture stderr output from the sub-agent
      child.stderr?.on("data", (chunk) => {
        const errorText = chunk.toString();
        childErrorLogs += errorText;
        console.error(`[Agent ${agentId} Stderr]: ${errorText}`);
      });
      // child send back response
      child.on(
        "message",
        (message: { type: "finished" | "failed"; artifactPath: string }) => {
          isHandled = true;
          if (message.type === "finished") {
            this.taskFinished(agentId, message.artifactPath, childErrorLogs);
          } else if (message.type === "failed") {
            this.taskFailed(agentId, message.artifactPath, childErrorLogs);
          }
        },
      );

      // catch process spawning or IPC transport errors
      child.on("error", (err) => {
        if (isHandled) return;
        isHandled = true;
        const errorMessage = `Process Error: ${err.message}\nStderr:\n${childErrorLogs}`;
        console.error(`[Agent ${agentId}] ${errorMessage}`);
        this.taskFailed(agentId, "", errorMessage);
      });

      // catch unexpected exits (uncaught exceptions, segfaults, OOM kills)
      child.on("exit", (code, signal) => {
        if (isHandled) return;
        isHandled = true;

        if (code === 0) {
          this.taskFinished(agentId, "", childErrorLogs);
        } else {
          const crashDetails = `Agent process crashed (code: ${code}, signal: ${signal}).\nStderr Output:\n${childErrorLogs}`;
          console.error(`[Agent ${agentId}] ${crashDetails}`);
          this.taskFailed(agentId, "", crashDetails);
        }
      });
    }

    return awaitedPromise;
  }
}
