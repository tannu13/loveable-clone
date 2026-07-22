import type { Message } from "@repo/shared";
import type { RedisClientType } from "redis";
import env from "../env";
import type { Content } from "@google/genai";
import { getCurrentFormattedDate } from "../utils";
import type { TUploadToS3 } from "./uploadFile";
import db from "@repo/db";
import { messageHistory } from "@repo/db/schema";

export class ResponseHandler {
  private publisher: RedisClientType;
  private uploadToS3: TUploadToS3;

  constructor(publisher: RedisClientType, uploadToS3: TUploadToS3) {
    this.publisher = publisher;
    this.uploadToS3 = uploadToS3;
  }

  send(type: Message["type"], payload: unknown) {
    this.publisher.publish(
      `convo-response`,
      JSON.stringify({ conversationId: env.CONVERSATION_ID, type, payload }),
    );
  }

  end() {
    this.publisher.publish(
      `convo-response`,
      JSON.stringify({
        conversationId: env.CONVERSATION_ID,
        type: "text",
        payload: "[DONE]",
      }),
    );
  }

  async backupHistory(history: Content[]) {
    await this.uploadToS3(
      { history },
      `${getCurrentFormattedDate()}-chat-backup-${env.CONVERSATION_ID}`,
    );
  }

  async saveToDB({
    type,
    content,
    metadata,
    role = "assistant",
  }: {
    type: Message["type"];
    content: string;
    metadata?: unknown;
    role?: Message["role"];
  }) {
    try {
      await db.insert(messageHistory).values({
        conversationId: env.CONVERSATION_ID,
        content,
        role,
        type,
        metadata,
      });
    } catch (err) {
      console.error("Message history write failed", err);
    }
  }
}
