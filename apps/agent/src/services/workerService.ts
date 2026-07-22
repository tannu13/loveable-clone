import { RedisMessageSchema, type TRedisMessageSchema } from "@repo/shared";
import type { RedisClientType } from "redis";
import env from "../env";
import type { Harness } from "./harness";

export class WorkerService {
  private subscriber: RedisClientType;
  private harness: Harness;

  constructor({
    subscriber,
    harness,
  }: {
    subscriber: RedisClientType;
    harness: Harness;
  }) {
    this.subscriber = subscriber;
    this.harness = harness;
  }

  async listenForJobs() {
    while (true) {
      const response = await this.subscriber.brPop(
        `convo-request-${env.CONVERSATION_ID}`,
        0,
      );
      if (!response) continue;

      try {
        const parsedElement = JSON.parse(response.element);
        const parsed = RedisMessageSchema.safeParse(parsedElement);
        if (!parsed.success) {
          console.error("Redis message payload invalid", parsed.error);
          continue;
        }

        this.handleJob(parsed.data);
      } catch (err) {
        console.error("Failed to parse payload", err);
      }
    }
  }

  async handleJob(jobData: TRedisMessageSchema) {
    this.harness.addUserPrompt(jobData.message);

    await this.harness.executeTask();
  }
}
