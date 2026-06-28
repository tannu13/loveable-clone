import express, { type Request, type Response } from "express";
import cors from "cors";
import z from "zod";
import { validate } from "./middlewares/validate";
import { Harness } from "./services/harness";
import { resolveResponse } from "./services/comms";
import env from "./env";
import { listProjectFiles } from "./services/projectFiles";
import type { Message, ProjectSnapshot, SendResponse } from "@repo/shared";

const previewUrl = env.PROJECT_PREVIEW_URL;
const messageHistory: Message[] = [];

const corsOptions = {
  origin: env.FRONTEND_URL,
};
const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  return res.json({
    ok: true,
  });
});

app.get("/api/project", async (_request, response) => {
  const files = await listProjectFiles();
  const ps: ProjectSnapshot = {
    summary: "",
    messageHistory,
    files,
    updatedAt:
      messageHistory.length > 0
        ? messageHistory[messageHistory.length - 1]!.createdAt
        : "",
    previewUrl,
  };

  response.status(200).json(ps);
});

const ConversationSchema = z.object({
  message: z.string().min(1, "Message is mandatory for the conversation"),
});
type TConversationSchema = z.infer<typeof ConversationSchema>;
app.post(
  "/api/conversation",
  validate("body", ConversationSchema),
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

    const sendResponse: SendResponse = (...args) => {
      const createdAt = new Date().toISOString();
      const message: Message =
        args[0] === "text"
          ? {
              role: "assistant",
              type: args[0],
              content: args[1],
              createdAt,
            }
          : {
              role: "assistant",
              type: args[0],
              content: args[1],
              createdAt,
            };
      messageHistory.push(message);
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    const endResponse = () => {
      res.end();
    };

    res.on("close", () => {
      res.end();
    });
    const { message } = req.body as TConversationSchema;
    messageHistory.push({
      role: "user",
      type: "text",
      content: message,
      createdAt: new Date().toISOString(),
    });

    const harness = new Harness(message, sendResponse, endResponse);
    await harness.executeTask();
  },
);

app.post("/api/user-reply", async (req: Request, res: Response) => {
  const { correlationId, answers } = req.body;
  console.log("correlationId", correlationId);

  resolveResponse(correlationId, answers)!;

  res.json({ recorded: true });
});

export default app;
export { app };
