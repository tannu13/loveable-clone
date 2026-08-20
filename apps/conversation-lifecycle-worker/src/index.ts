import { startLifecycleWorker } from "./lifecycleWorker";
import { LifecycleWorkerService } from "./services/lifecyle-worker-service";
import { redis } from "./services/redis";

const redisClient = await redis();
const lifecycleWorkerService = new LifecycleWorkerService(redisClient);
// start worker which periodically checks for conversations that have gone stale
startLifecycleWorker(lifecycleWorkerService);
