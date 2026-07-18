import { saveConversation, saveMessage } from "../models/conversation-model";
import type { RedisClientType } from "redis";
import type { K8Service } from "./k8Service";
import type { TRedisMessageSchema } from "@repo/shared";

export class ConversationService {
  private publisher: RedisClientType;
  private k8Service: K8Service;

  constructor({
    redis,
    k8Service,
  }: {
    redis: RedisClientType;
    k8Service: K8Service;
  }) {
    this.publisher = redis;
    this.k8Service = k8Service;
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

    // create job for this and push it to agent process via redis
    const messagePayload: TRedisMessageSchema = {
      conversationId,
      message,
    };
    await this.publisher.lPush(
      `convo-request-${conversationId}`,
      JSON.stringify(messagePayload),
    );

    // td::spin up a pod in k8 cluster with an agent worker (who listens to this job) and project app
    this.k8Service.ensureConversationPod(conversationId);

    return { conversationId };
  }
}
