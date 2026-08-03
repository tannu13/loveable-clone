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
