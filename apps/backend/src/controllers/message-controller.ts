import type { Request, Response } from "express";
import type { TConversationSchema } from "../types/validations";
import {
  getConversation,
  saveConversation,
  saveMessage,
} from "../models/conversation";

export const converse = async (req: Request, res: Response) => {
  const { message } = req.body as TConversationSchema;
  const payload = {
    content: message,
    role: "user",
    type: "text",
  } as const;
  const conversationId = req.params.id
    ? await saveMessage(req.params.id as string, payload)
    : await saveConversation(payload);

  const conversation = await getConversation(conversationId);
};
