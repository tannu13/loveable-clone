import type { Request, Response } from "express";
import type {
  TConversationSchema,
  TReadFileQuerySchema,
} from "../types/validations";
import type { ConversationService } from "../services/conversation-service";
import type { TQnAReplySchema } from "@repo/shared";
import { UnauthorizedError } from "../utils/custom-errors";

export const createControllers = (service: ConversationService) => {
  const getConversation = async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError();
    }
    const data = await service.getMessage(id, userId);

    if (!data) return res.status(404).send();
    return res.status(200).json(data);
  };

  const converse = async (req: Request, res: Response) => {
    const { message } = req.body as TConversationSchema;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError();
    }

    const { conversationId, previewUrl } = await service.handleMessage(
      message,
      userId,
      req.params.id as string | undefined,
    );

    return res.status(200).json({ conversationId, previewUrl });
  };

  const qnaReply = async (req: Request, res: Response) => {
    const conversationId = req.params.id as string;
    const { answers, correlationId } = req.body as TQnAReplySchema;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError();
    }

    await service.handleAnswers(conversationId, userId, correlationId, answers);

    return res.status(200).json({ ok: true });
  };

  const listFiles = async (req: Request, res: Response) => {
    const conversationId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError();
    }

    await service.requestFileList(conversationId, userId);

    return res.status(202).json({ ok: true });
  };

  const readFile = async (req: Request, res: Response) => {
    const conversationId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError();
    }

    const { path } = req.validated?.query as TReadFileQuerySchema;

    await service.requestFileContent(conversationId, userId, path);

    return res.status(202).json({ ok: true });
  };

  return { converse, qnaReply, getConversation, listFiles, readFile };
};
export type TControllers = ReturnType<typeof createControllers>;
