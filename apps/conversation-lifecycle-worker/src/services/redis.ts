import { createClient, type RedisClientType } from "redis";
import env from "../env";

export async function createConnection() {
  const client = createClient({
    url: env.REDIS_URL,
  });

  return client.connect();
}

let shared: RedisClientType | undefined;

export async function redis() {
  if (!shared) shared = await createConnection();
  return shared;
}
