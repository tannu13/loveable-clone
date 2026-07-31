import type { Harness } from "./agentServices/harness";

class Orchestrator {
  private maxDepth = 5;
  private parentId: string;
  private agentsPendingCount = 0;
  private queue: Map<
    string,
    {
      agent: Harness;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
      artifactPath: string;
    }
  > = new Map();

  constructor(parentId: string) {
    this.parentId = parentId;
  }

  private areAllDone() {
    if (this.agentsPendingCount !== 0) return;

    // all agents are done by either completing or failing
    // td:: notify the parent somehow so that it can continue. by maybe resolving the parent's promise (loopback)
    // the parent would need the array of [agent id, task given (this can be maintained by the main agent itself), artifact path and status]
  }

  addHarness(agentId: string, agent: Harness) {
    this.queue.set(agentId, { agent, status: "PENDING", artifactPath: "" });
    this.agentsPendingCount++;
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
    this.agentsPendingCount--;

    this.areAllDone();
  }

  spawnAgents() {
    // td:: spawn the agents in the queue with an extra tool call which allows them to submit result back to main, so that task finished / failed can be called
  }
}
