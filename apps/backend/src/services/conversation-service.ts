import { saveConversation, saveMessage } from "../models/conversation-model";
import type { RedisClientType } from "redis";
import type { K8Service } from "./k8sService";
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
      type: "text",
      message,
    };
    await this.publisher.lPush(
      `convo-request-${conversationId}`,
      JSON.stringify(messagePayload),
    );

    await this.k8Service.ensureWorkspacePVC(conversationId);
    await this.k8Service.ensureConversationDeployment(conversationId);
    await this.k8Service.ensurePreviewService(conversationId);
    await this.k8Service.ensurePreviewIngress(conversationId);

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
