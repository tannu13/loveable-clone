import type { Request, Response } from "express";
import type { TConversationSchema } from "../types/validations";
import type { ConversationService } from "../services/conversation-service";

export const createControllers = (service: ConversationService) => {
  const converse = async (req: Request, res: Response) => {
    const { message } = req.body as TConversationSchema;

    const { conversationId } = await service.handleMessage(
      message,
      req.params.id as string | undefined,
    );

    return res.status(200).json({ conversationId });
  };

  const streamMessages = async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  };

  return { converse, streamMessages };
};
export type TControllers = ReturnType<typeof createControllers>;
