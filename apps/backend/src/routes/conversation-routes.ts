import { Router } from "express";
import { validate } from "../middlewares/validate";
import { ConversationSchema } from "../types/validations";
import { type TControllers } from "../controllers/message-controller";

export const createRoutes = (controllers: TControllers) => {
  const convoRouter = Router();

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

  convoRouter.get("/api/conversation/:id/stream", controllers.streamMessages);

  return { convoRouter };
};
