import env from "./env";
import { createWSServer } from "./services/createWSServer";
import { setupComms } from "./services/redis";

const server = createWSServer();
const subscriber = await setupComms();
await subscriber.subscribe(env.PUB_SUB_QUEUE, (message) => {
  console.log("Received: ", message);
  const response = JSON.parse(message) as {
    conversationId: string;
    type: string;
    payload: unknown;
  };
  server.publish(`conversation:${response.conversationId}`, message);
});
