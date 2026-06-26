import express, { type Request, type Response } from "express";
import z from "zod";
import { validate } from "./middlewares/validate";
import { Agent } from "./services/agent";
import env from "./env";
import { ToolRegistry } from "./services/tools";
import { Harness } from "./services/harness";
import { resolveResponse } from "./services/comms";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  return res.json({
    ok: true,
  });
});

const ConversationSchema = z.object({
  message: z.string().min(1, "Message is mandatory for the conversation"),
});
type TConversationSchema = z.infer<typeof ConversationSchema>;
app.post(
  "/conversation",
  validate("body", ConversationSchema),
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

    const sendResponse = (payload: string) => {
      res.write(`data: ${payload}\n\n`);
    };

    const endResponse = () => {
      res.end();
    };

    res.on("close", () => {
      res.end();
    });
    const { message } = req.body as TConversationSchema;

    const harness = new Harness(message, sendResponse, endResponse);
    await harness.executeTask();
  },
);

app.post("/user-reply", async (req: Request, res: Response) => {
  const { correlationId, answers } = req.body;
  console.log("correlationId", correlationId);

  resolveResponse(correlationId, answers)!;

  res.json({ recorded: true });
});

export default app;
export { app };
