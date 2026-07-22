import { setupComms } from "./services/redis";
import env from "./env";
import { type SendResponse } from "@repo/shared";
import { WorkerService } from "./services/worker-service";
import { Harness } from "./services/harness";
import { createUploader } from "./services/upload-file";
import type { EndResponse } from "./types";
import { getCurrentFormattedDate } from "./utils";
import type { Content } from "@google/genai";

const { subscriber, publisher } = await setupComms();
const { loadStoreFromS3, uploadToS3 } = createUploader();
const sendResponse: SendResponse = (type, payload) => {
  publisher.publish(
    `convo-response`,
    JSON.stringify({ conversationId: env.CONVERSATION_ID, type, payload }),
  );
};
const endResponse: EndResponse = async (history) => {
  publisher.publish(
    `convo-response`,
    JSON.stringify({
      conversationId: env.CONVERSATION_ID,
      type: "text",
      payload: "[DONE]",
    }),
  );

  await uploadToS3(
    { history },
    `${getCurrentFormattedDate()}-chat-backup-${env.CONVERSATION_ID}`,
  );
};

let history: Content[] = [];
const historyFromBackup = (await loadStoreFromS3()) as {
  history: Content[];
} | null;
if (historyFromBackup) {
  history = historyFromBackup.history;
}
const harness = new Harness(sendResponse, endResponse, history);
const worker = new WorkerService({ subscriber, harness });

//td:: on boot - load up messages from db for this conversation, if any
// worker.loadContext

worker.listenForJobs();
