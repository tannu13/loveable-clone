import { sleep } from "bun";
import { LifecycleWorkerService } from "./services/lifecyle-worker-service";
import { createConnection } from "./services/redis";
import { LifeCycleWorkerCommsSchema } from "@repo/shared";
import { K8sTeardownService } from "@repo/k8s";
import env from "./env";

export async function startLifecycleWorker(
  lifecycleWorkerService: LifecycleWorkerService,
) {
  while (true) {
    try {
      const conversationIds =
        await lifecycleWorkerService.findIdleConversationIds();

      if (conversationIds.length === 0) return;

      // scale down the conversation ids based infra
      conversationIds.forEach(async (id) => {
        // doing a leader election via lock in case this process becomes the bottleneck
        // and is horizontally scaled
        const lockAcquired =
          await lifecycleWorkerService.tryAcquireReaperLock(id);

        if (!lockAcquired) return;

        // across multiple instances, this instance won the leader election.
        // so it gets the task of scaling down the infra for this conversaion id
        // to do that, first send the agent message to pack up via conversation id
        // based redis queue. agent moves the pvc content into an object store.
        // then send an event back via pub sub
        //
        /**
         * maybe i need another lock here - a longer shutdown in progress lock, because
         * this instance after winning the leader election now sends a message to the agent,
         * but the agent might be doing something and now would stop taking in any other requests
         * and then packup. this whole process might take some time, so we need to make sure
         * that even after the initial reaper lock has expired and some other instance or
         * even this instance picks this conversation id again, it does not send the shutdown
         * message to agent again. confused, as the agent would've stopped taking in any new
         * messages so that might not matter even if another instance picks it up - think more...
         * Possible solution - delete the zset altogether - tradeoff - it takes away replayability in case of a crash
         * Possible solution - longer shutdown locks still adds an additional idempotent layer
         */

        await lifecycleWorkerService.sendShutdownMessageToAgent(id);
      });
    } catch (error) {
      console.error(error);
    }

    await sleep(30_000);
  }
}

export async function listenShutdownReadyMessages() {
  const client = await createConnection();
  const teardownService = new K8sTeardownService({
    k8sNamespace: env.K8S_NAMESPACE,
  });
  while (true) {
    const response = await client.brPop(`shutdown_ready_agent`, 0);
    if (!response) continue;

    const parsed = LifeCycleWorkerCommsSchema.safeParse(response);
    if (!parsed.success) {
      // skip
      continue;
    }

    if (parsed.data.type === "shutdown_ready") {
      teardownService.teardownInfrastructure(parsed.data.conversationId);
    }
  }
}
