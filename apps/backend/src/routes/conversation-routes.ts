import { Router } from "express";
import { validate } from "../middlewares/validate";
import { authMiddleware } from "../middlewares/auth";
import {
  ConversationSchema,
  ReadFileQuerySchema,
  RenameConversationSchema,
} from "../types/validations";
import { type TControllers } from "../controllers/message-controller";
import { QnAReplySchema } from "@repo/shared";

export const createRoutes = (controllers: TControllers) => {
  const convoRouter = Router();

  convoRouter.use("/api/conversation", authMiddleware);

  convoRouter.get("/api/conversation", controllers.listConversations);
  convoRouter.get("/api/conversation/:id", controllers.getConversation);
  convoRouter.patch(
    "/api/conversation/:id",
    validate("body", RenameConversationSchema),
    controllers.renameConversation,
  );
  convoRouter.delete("/api/conversation/:id", controllers.deleteConversation);

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

  convoRouter.get("/api/conversation/:id/files", controllers.listFiles);
  convoRouter.get(
    "/api/conversation/:id/files/content",
    validate("query", ReadFileQuerySchema),
    controllers.readFile,
  );

  return { convoRouter };
};
