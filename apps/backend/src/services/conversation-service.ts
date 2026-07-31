import { saveConversation, saveMessage } from "../models/conversation-model";
import type { RedisClientType } from "redis";
import type { K8Service } from "./k8sService";
import type { TRedisMessageSchema } from "@repo/shared";
import { setSpanAttributes, withActiveSpan } from "@repo/observability";

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

    if (conversationId) {
      setSpanAttributes({
        "conversation.id": conversationId,
      });
    }

    conversationId = await withActiveSpan("message.save", async () => {
      return conversationId
        ? await saveMessage(conversationId as string, payload)
        : await saveConversation(payload);
    });

    setSpanAttributes({
      "conversation.id": conversationId,
    });

    await withActiveSpan("redis.push", async () => {
      // create job for this and push it to agent process via redis
      const messagePayload: TRedisMessageSchema = {
        conversationId,
        type: "text",
        message,
      };
      await this.publisher.lPush(
        `convo-request-${conversationId}`,
        JSON.stringify(messagePayload),
      );
    });

    this.k8Service.ensureInfrastructure(conversationId);

    return {
      conversationId,
      previewUrl: this.k8Service.getPreviewUrl(conversationId),
    };
  }

  async handleAnswers(
    conversationId: string,
    correlationId: string,
    answers: unknown,
  ) {
    const answerPayload: TRedisMessageSchema = {
      conversationId,
      type: "qna",
      message: { correlationId, answers },
    };
    await this.publisher.lPush(
      `convo-request-${conversationId}`,
      JSON.stringify(answerPayload),
    );
  }
}
