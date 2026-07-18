import { setupComms } from "./services/redis";
import env from "./env";
import { type SendResponse } from "@repo/shared";
import { WorkerService } from "./services/worker-service";
import { Harness } from "./services/harness";

const { subscriber, publisher } = await setupComms();
const sendResponse: SendResponse = (type, payload) => {
  publisher.publish(
    `convo-response`,
    JSON.stringify({ conversationId: env.CONVERSATION_ID, type, payload }),
  );
};
const harness = new Harness(sendResponse);
const worker = new WorkerService({ subscriber, harness });

//td:: on boot - load up messages from db for this conversation, if any
// worker.loadContext

worker.listenForJobs();
