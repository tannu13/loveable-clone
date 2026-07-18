import { createClient } from "redis";
import env from "../env";

export const setupComms = async () => {
  const subscriber = createClient({
    url: env.REDIS_URL,
  });

  const publisher = createClient({
    url: env.REDIS_URL,
  });

  await Promise.all([publisher.connect(), subscriber.connect()]);

  return { subscriber, publisher };
};
