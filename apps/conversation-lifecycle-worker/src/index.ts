import {
  listenShutdownReadyMessages,
  startLifecycleWorker,
} from "./lifecycleWorker";
import { LifecycleWorkerService } from "./services/lifecyle-worker-service";
import { redis } from "./services/redis";

const redisClient = await redis();
const lifecycleWorkerService = new LifecycleWorkerService(redisClient);
// start worker which periodically checks for conversations that have gone stale
startLifecycleWorker(lifecycleWorkerService).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
// consume the agents' shutdown-ready signals and tear their infra down
listenShutdownReadyMessages().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
