import { createNodeRedisClient, Queue } from "bullmq";
import { saveConversation, saveMessage } from "../models/conversation-model";
import type { RedisClientType } from "redis";

export class ConversationService {
  private redis: RedisClientType;
  constructor({ redis }: { redis: RedisClientType }) {
    this.redis = redis;
  }
  async handleMessage(message: string, conversationId?: string) {
    const payload = {
      content: message,
      role: "user",
      type: "text",
    } as const;

    conversationId = conversationId
      ? await saveMessage(conversationId as string, payload)
      : await saveConversation(payload);

    // create job for this and push it to agent process via bullmq
    const connection = createNodeRedisClient(this.redis as any);
    const convoQ = new Queue(`convo-${conversationId}`, { connection });
    convoQ.add("user-message", {
      conversationId,
      message,
    });

    // td::spin up a pod in k8 cluster with an agent worker (who listens to this job) and project app

    return { conversationId };
  }
}
