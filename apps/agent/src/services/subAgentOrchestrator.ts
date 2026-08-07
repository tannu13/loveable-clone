import { fork } from "node:child_process";
import path from "node:path";
import { checkFileExists } from "../utils/helpers";

const SUBAGENT_BOOT_FILE_PATH = path.resolve(
  import.meta.dirname,
  "../subAgent.ts",
);
export class SubAgentOrchestrator {
  private maxDepth = 5;
  private parentId: string;
  private agentsRequired = 0;
  private agentsPendingCount = 0;
  private queue: Map<
    string,
    {
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
      systemPrompt: string;
      taskDescription: string;
      artifactPath: string;
    }
  > = new Map();

  constructor(parentId: string) {
    this.parentId = parentId;
  }

  private areAllDone() {
    if (this.agentsPendingCount !== 0) return false;

    // all agents are done by either completing or failing
    // td:: notify the parent somehow so that it can continue. by maybe resolving the parent's promise (loopback)
    // the parent would need the array of [agent id, task given (this can be maintained by the main agent itself), artifact path and status]
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
      artifactPath: ``,
    });
    this.agentsRequired++;
  }

  taskFinished(agentId: string, artifactPath: string) {
    const task = this.queue.get(agentId);
    if (!task) return;

    task.status = "COMPLETED";
    task.artifactPath = artifactPath;
    this.agentsPendingCount--;

    this.areAllDone();
  }

  taskFailed(agentId: string, artifactPath: string) {
    const task = this.queue.get(agentId);
    if (!task) return;

    task.status = "FAILED";
    task.artifactPath = artifactPath;
    this.agentsPendingCount--;

    this.areAllDone();
  }

  async spawnAgents() {
    // td:: spawn the agents in the queue with an extra tool call which allows them to submit result back to main, so that task finished / failed can be called
    if (!(await checkFileExists(SUBAGENT_BOOT_FILE_PATH))) {
      throw new Error("Unable to find sub agent boot file: `subAgent.ts`");
    }
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

      // child send back response
      child.on(
        "message",
        (message: { type: "finished" | "failed"; artifactPath: string }) => {
          if (message.type === "finished") {
            this.taskFinished(agentId, message.artifactPath);
          } else if (message.type === "failed") {
            this.taskFailed(agentId, message.artifactPath);
          }
        },
      );

      let childErrorLogs = "";
      child.stderr?.on("data", (chunk) => {
        const errorText = chunk.toString();
        childErrorLogs += errorText;
        console.error(`[Child Stderr]: ${errorText}`);
      });

      child.on("message", () => {});
    }
  }
}
