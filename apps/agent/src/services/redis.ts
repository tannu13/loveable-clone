import { createClient } from "redis";
import env from "../env";

export const setupComms = async () => {
  const redisClient = createClient({
    url: env.REDIS_URL,
  });

  await redisClient.connect();

  return redisClient;
};
