import { createClient } from "redis";
import env from "../env";

export const setupComms = async () => {
  const subscriber = createClient({ url: env.REDIS_URL });
  await subscriber.connect();

  return subscriber;
};
