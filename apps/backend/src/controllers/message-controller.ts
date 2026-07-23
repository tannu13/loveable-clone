import type { Request, Response } from "express";
import type { TConversationSchema } from "../types/validations";
import type { ConversationService } from "../services/conversation-service";
import type { TQnAReplySchema } from "@repo/shared";

export const createControllers = (service: ConversationService) => {
  const converse = async (req: Request, res: Response) => {
    const { message } = req.body as TConversationSchema;

    const { conversationId } = await service.handleMessage(
      message,
      req.params.id as string | undefined,
    );

    return res.status(200).json({ conversationId });
  };

  const qnaReply = async (req: Request, res: Response) => {
    const conversationId = req.params.id as string;
    const { answers, correlationId } = req.body as TQnAReplySchema;

    await service.handleAnswers(conversationId, correlationId, answers);

    return res.status(200).json({ ok: true });
  };

  return { converse, qnaReply };
};
export type TControllers = ReturnType<typeof createControllers>;
