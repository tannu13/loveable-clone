import { Router } from "express";
import { validate } from "../middlewares/validate";
import { authMiddleware } from "../middlewares/auth";
import { ConversationSchema } from "../types/validations";
import { type TControllers } from "../controllers/message-controller";
import { QnAReplySchema } from "@repo/shared";

export const createRoutes = (controllers: TControllers) => {
  const convoRouter = Router();

  convoRouter.use("/api/conversation", authMiddleware);

  convoRouter.post(
    "/api/conversation/",
    validate("body", ConversationSchema),
    controllers.converse,
  );
  convoRouter.post(
    "/api/conversation/:id",
    validate("body", ConversationSchema),
    controllers.converse,
  );

  convoRouter.post(
    "/api/conversation/:id/qna-reply",
    validate("body", QnAReplySchema),
    controllers.qnaReply,
  );

  return { convoRouter };
};
