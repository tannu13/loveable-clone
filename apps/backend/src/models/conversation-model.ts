import db from "@repo/db";
import { and, eq } from "@repo/db";
import {
  conversations,
  messageHistory,
  type TMessageRoleEnum,
  type TMessageTypeEnum,
} from "@repo/db/schema";
import { InternalServerError, NotFoundError } from "../utils/custom-errors";

export const getConversation = async (id: string, userId: string) => {
  try {
    return await db.query.conversations.findFirst({
      where: ({ id: conversationId, userId: conversationUserId }) =>
        and(eq(conversationId, id), eq(conversationUserId, userId)),
      with: {
        messageHistory: {
          columns: {
            content: true,
            role: true,
            type: true,
            metadata: true,
            createdAt: true,
          },
          orderBy({ createdAt }, { asc }) {
            return [asc(createdAt)];
          },
        },
      },
    });
  } catch {
    throw new InternalServerError("Unable to fetch conversations");
  }
};

export type ConversationWithMessageHistory = Awaited<
  ReturnType<typeof getConversation>
>;

export const listConversationsForUser = async (userId: string) => {
  try {
    return await db.query.conversations.findMany({
      where: ({ userId: conversationUserId }) => eq(conversationUserId, userId),
      orderBy: ({ updatedAt }, { desc }) => [desc(updatedAt)],
      columns: {
        id: true,
        title: true,
        hasStartedBuildingApp: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch {
    throw new InternalServerError("Unable to fetch conversations");
  }
};

export const saveConversation = async ({
  content,
  role,
  type,
  userId,
}: {
  content: string;
  role: TMessageRoleEnum;
  type: TMessageTypeEnum;
  userId: string;
}): Promise<string> => {
  try {
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId,
        title: content.slice(0, 255),
      })
      .returning();

    if (!conversation) {
      throw new InternalServerError("Unable to save conversation");
    }

    await db.insert(messageHistory).values({
      conversationId: conversation.id,
      content,
      role,
      type,
    });

    return conversation.id;
  } catch {
    throw new InternalServerError();
  }
};
export const saveMessage = async (
  conversationId: string,
  userId: string,
  {
    content,
    role,
    type,
  }: { content: string; role: TMessageRoleEnum; type: TMessageTypeEnum },
) => {
  try {
    await assertConversationBelongsToUser(conversationId, userId);

    await db.insert(messageHistory).values({
      conversationId,
      content,
      role,
      type,
    });

    return conversationId;
  } catch (err) {
    console.log("Error saving message", err);

    if (err instanceof NotFoundError) {
      throw err;
    }

    throw new InternalServerError();
  }
};

export const renameConversation = async (
  conversationId: string,
  userId: string,
  title: string,
) => {
  await assertConversationBelongsToUser(conversationId, userId);

  try {
    const [conversation] = await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, conversationId))
      .returning();

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    return conversation;
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw err;
    }

    throw new InternalServerError("Unable to rename conversation");
  }
};

export const deleteConversation = async (
  conversationId: string,
  userId: string,
) => {
  await assertConversationBelongsToUser(conversationId, userId);

  try {
    // message_history.conversation_id has no ON DELETE CASCADE, so the
    // child rows have to go first or the FK constraint rejects the
    // conversation delete. Wrapped in a transaction so a failure partway
    // through doesn't leave the conversation orphaned-but-messageless.
    await db.transaction(async (tx) => {
      await tx
        .delete(messageHistory)
        .where(eq(messageHistory.conversationId, conversationId));
      await tx.delete(conversations).where(eq(conversations.id, conversationId));
    });
  } catch {
    throw new InternalServerError("Unable to delete conversation");
  }
};

export const assertConversationBelongsToUser = async (
  conversationId: string,
  userId: string,
) => {
  try {
    const conversation = await db.query.conversations.findFirst({
      where: ({ id, userId: conversationUserId }) =>
        and(eq(id, conversationId), eq(conversationUserId, userId)),
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    return conversation;
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw err;
    }

    throw new InternalServerError("Unable to fetch conversation");
  }
};
