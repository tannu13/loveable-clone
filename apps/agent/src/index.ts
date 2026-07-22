import { setupComms } from "./services/redis";
import { WorkerService } from "./services/workerService";
import { Harness } from "./services/harness";
import { createUploader } from "./services/uploadFile";
import type { Content } from "@google/genai";
import { ResponseHandler } from "./services/responseHandler";

const { subscriber, publisher } = await setupComms();
const { loadBackupFromS3, uploadToS3 } = createUploader();

const responseHandler = new ResponseHandler(publisher, uploadToS3);

let history: Content[] = [];
const historyFromBackup = (await loadBackupFromS3()) as {
  history: Content[];
} | null;
if (historyFromBackup) {
  history = historyFromBackup.history;
}
const harness = new Harness(responseHandler, history);
const worker = new WorkerService({ subscriber, harness });

worker.listenForJobs();
