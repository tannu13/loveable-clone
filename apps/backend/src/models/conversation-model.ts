import db from "../db";
import {
  conversations,
  messageHistory,
  type TMessageRoleEnum,
  type TMessageTypeEnum,
} from "../db/schema";
import { InternalServerError, NotFoundError } from "../utils/custom-errors";

export const getConversation = async (id: string) => {
  try {
    return await db.query.conversations.findFirst({
      where(fields, { eq }) {
        return eq(fields.id, id);
      },
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
}: {
  content: string;
  role: TMessageRoleEnum;
  type: TMessageTypeEnum;
}) => {
  try {
    const [conversation] = await db
      .insert(conversations)
      .values({
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
  {
    content,
    role,
    type,
  }: { content: string; role: TMessageRoleEnum; type: TMessageTypeEnum },
) => {
  try {
    const conversation = await db.query.conversations.findFirst({
      where: ({ id }, { eq }) => eq(id, conversationId),
    });
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    await db.insert(messageHistory).values({
      conversationId,
      content,
      role,
      type,
    });

    return conversationId;
  } catch {
    throw new InternalServerError();
  }
};
