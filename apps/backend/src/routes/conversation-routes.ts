import { Router } from "express";
import { validate } from "../middlewares/validate";
import { ConversationSchema } from "../types/validations";
import { converse } from "../controllers/message-controller";

const convoRouter = Router();

convoRouter.post(
  "/api/conversation/",
  validate("body", ConversationSchema),
  converse,
);
convoRouter.post(
  "/api/conversation/:id",
  validate("body", ConversationSchema),
  converse,
);
