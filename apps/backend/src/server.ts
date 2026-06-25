import express, { type Request, type Response } from "express";
import z from "zod";
import { validate } from "./middlewares/validate";

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

    // When client closes connection, stop sending events
    req.on("close", () => {
      res.end();
    });
    const { message } = req.body as TConversationSchema;
    console.log("message", message);
    res.status(200).json({
      message,
    });
  },
);

export default app;
export { app };
