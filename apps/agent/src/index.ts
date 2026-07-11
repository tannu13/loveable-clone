import { setupComms } from "./services/redis";
import env from "./env";
import { RedisMessageSchema } from "@repo/shared";

const subscriber = await setupComms();

//td:: on boot - load up messages from db for this conversation, if any

while (true) {
  const response = await subscriber.brPop(`convo-${env.CONVERSATION_ID}`, 0);
  if (!response) continue;

  try {
    const parsedElement = JSON.parse(response.element);
    const parsed = RedisMessageSchema.safeParse(parsedElement);
    if (!parsed.success) {
      console.error("Redis message payload invalid", parsed.error);
      continue;
    }

    const data = parsed.data;
  } catch (err) {
    console.error("Failed to parse payload", err);
  }
}
