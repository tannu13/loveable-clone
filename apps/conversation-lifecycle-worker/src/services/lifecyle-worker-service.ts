import {
  getConversationHeartbeatName,
  getMessageToAgentQueueName,
  type TRedisMessageSchema,
} from "@repo/shared";
import type { RedisClientType } from "redis";

export class LifecycleWorkerService {
  private redis: RedisClientType;

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  async findIdleConversationIds() {
    const now = Date.now();
    const conversationIds = await this.redis.zRangeByScore(
      getConversationHeartbeatName(),
      "-inf",
      now,
    );

    return conversationIds;
  }

  // leader election -- tada...
  async tryAcquireReaperLock(conversationId: string) {
    // first check the longer conversation id based shutdown lock, which would indicate this process has already been picked up for shutdown
    const exists = await this.redis.exists(`shutdown:${conversationId}`);
    if (exists === 1) {
      return false;
    }
    const res = await this.redis.set(
      `lifecycle:reaper-lock:${conversationId}`,
      1,
      {
        condition: "NX",
        expiration: { type: "EX", value: 30 },
      },
    );

    return res === "OK";
  }

  async sendShutdownMessageToAgent(conversationId: string) {
    // set a longer conversation id based shutdown lock to make the operation idempotent
    // because the shutdown might take more than 30 secs (the reaper lock expiry) to
    // complete and in that time any instance including this one after the reaper lock
    // has expired, could pickup the conversation for shutdown.

    // both the locks solve different problems - reaper lock helps with leader election
    // but that too for a shorter time which represents the time for which this instance
    // is the leader. if it fails to initiate shutdown, the next leader would be able to
    // pick it up. the shutdown lock is to make the process idempotent, i.e. if the next
    // leader after the first one expires, does pick up the same conversaion, they'd not
    // be able to initiate the shutdown because of the longer lock on the conversation itself.

    const messagePayload: TRedisMessageSchema = {
      conversationId,
      type: "initiate_shutdown",
      message: null,
    };
    await this.redis.lPush(
      getMessageToAgentQueueName(conversationId),
      JSON.stringify(messagePayload),
    );

    await this.redis.set(`shutdown:${conversationId}`, 1, {
      condition: "NX",
      expiration: { type: "EX", value: 300 },
    });
  }
}
