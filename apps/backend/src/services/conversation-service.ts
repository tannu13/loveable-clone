import {
  assertConversationBelongsToUser,
  saveConversation,
  saveMessage,
} from "../models/conversation-model";
import type { RedisClientType } from "redis";
import type { K8Service } from "./k8sService";
import type { TRedisMessageSchema } from "@repo/shared";
import { setSpanAttributes, withActiveSpan } from "@repo/observability";
import { logger } from "../logger";

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

  async handleMessage(
    message: string,
    userId: string,
    conversationId?: string,
  ) {
    const payload = {
      content: message,
      role: "user",
      type: "text",
    } as const;

    if (conversationId) {
      setSpanAttributes({
        "conversation.id": conversationId,
        "user.id": userId,
      });
    }

    conversationId = await withActiveSpan("message.save", async () => {
      logger.info("Saving conversation");
      return conversationId
        ? await saveMessage(conversationId, userId, payload)
        : await saveConversation({ ...payload, userId });
    });

    setSpanAttributes({
      "conversation.id": conversationId,
    });

    await withActiveSpan("redis.push", async () => {
      logger.info("Pushing conversation message to redis");
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
    userId: string,
    correlationId: string,
    answers: unknown,
  ) {
    await assertConversationBelongsToUser(conversationId, userId);

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
