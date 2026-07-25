import { setupComms } from "./services/redis";
import { WorkerService } from "./services/workerService";
import { Harness } from "./services/agentServices/harness";
import { s3Service } from "./services/uploadFile";
import type { Content } from "@google/genai";
import { ResponseHandler } from "./services/responseHandler";

const { subscriber, publisher } = await setupComms();
const responseHandler = new ResponseHandler(publisher, s3Service.uploadToS3);

let history: Content[] = [];
const historyFromBackup = (await s3Service.loadBackupFromS3()) as {
  history: Content[];
} | null;
if (historyFromBackup) {
  history = historyFromBackup.history;
}
const harness = new Harness(responseHandler, history);
const worker = new WorkerService({ subscriber, harness });

worker.listenForJobs();
