import db, { eq } from "@repo/db";
import { conversations, messageHistory } from "@repo/db/schema";
import type { Message } from "@repo/shared";
import env from "../env";

export async function saveMessageHistory({
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

export async function toggleConversationAppFlag() {
  try {
    await db
      .update(conversations)
      .set({ hasStartedBuildingApp: true })
      .where(eq(conversations.id, env.CONVERSATION_ID));
  } catch (err: unknown) {
    console.error("Unable to update conversations table", err);
  }
}
