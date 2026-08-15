import {
  assertConversationBelongsToUser,
  deleteConversation,
  getConversation,
  listConversationsForUser,
  renameConversation,
  saveConversation,
  saveMessage,
} from "../models/conversation-model";
import type { RedisClientType } from "redis";
import type { K8Service } from "./k8sService";
import type { TRedisMessageSchema } from "@repo/shared";
import { setSpanAttributes, withActiveSpan } from "@repo/observability";
import { logger } from "../logger";
import { toWireMessages } from "./message-history-mapper";

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

  async listConversations(userId: string) {
    return await listConversationsForUser(userId);
  }

  async renameConversation(id: string, userId: string, title: string) {
    return await renameConversation(id, userId, title);
  }

  async deleteConversation(id: string, userId: string) {
    await deleteConversation(id, userId);
    // Best-effort infra cleanup, same fire-and-forget convention as
    // ensureInfrastructure in handleMessage — a k8s hiccup here shouldn't
    // block the (already-succeeded) delete response.
    this.k8Service.teardownInfrastructure(id);
  }

  async getMessage(id: string, userId: string) {
    const conversation = await getConversation(id, userId);

    if (!conversation) {
      return conversation;
    }

    return {
      ...conversation,
      previewUrl: this.k8Service.getPreviewUrl(id),
      messageHistory: toWireMessages(conversation.messageHistory),
    };
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

  async requestFileList(conversationId: string, userId: string) {
    await assertConversationBelongsToUser(conversationId, userId);

    const jobPayload: TRedisMessageSchema = {
      conversationId,
      type: "list_files",
      message: null,
    };
    await this.publisher.lPush(
      `convo-request-${conversationId}`,
      JSON.stringify(jobPayload),
    );
  }

  async requestFileContent(
    conversationId: string,
    userId: string,
    path: string,
  ) {
    await assertConversationBelongsToUser(conversationId, userId);

    const jobPayload: TRedisMessageSchema = {
      conversationId,
      type: "read_file",
      message: { path },
    };
    await this.publisher.lPush(
      `convo-request-${conversationId}`,
      JSON.stringify(jobPayload),
    );
  }
}
