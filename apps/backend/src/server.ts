import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import env from "./env";
import type { Message } from "@repo/shared";
import { AppError } from "./utils/custom-errors";
import { setupComms } from "./services/redis";
import { createRoutes } from "./routes/conversation-routes";
import { createSessionRoutes } from "./routes/session-routes";
import { createUserRoutes } from "./routes/user-routes";
import { createControllers } from "./controllers/message-controller";
import { ConversationService } from "./services/conversation-service";
import { K8Service } from "./services/k8sService";
import { addHttpMetrics } from "./middlewares/http-metrics";
import { logger } from "./logger";
import { withActiveSpan } from "@repo/observability";

const redisClient = await setupComms();
let k8Service: K8Service;
try {
  k8Service = new K8Service();
} catch (error) {
  logger.error(
    "Failed to initialize Kubernetes client. Check that minikube is running and kubectl has an active context.",
  );
  throw error;
}

const conversationService = new ConversationService({
  redis: redisClient,
  k8Service,
});
const controllers = createControllers(conversationService);
const previewUrl = env.PROJECT_PREVIEW_URL;
const messageHistory: Message[] = [];

const corsOptions = {
  origin: env.FRONTEND_URL,
};
const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(addHttpMetrics);

app.get("/health", (_req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
  });
});

// td:: move the list project files endpoint to agent or the app runner
// app.get("/api/project", async (_request, response) => {
//   const files = await listProjectFiles();
//   const ps: ProjectSnapshot = {
//     summary: "",
//     messageHistory,
//     files,
//     updatedAt:
//       messageHistory.length > 0
//         ? messageHistory[messageHistory.length - 1]!.createdAt
//         : "",
//     previewUrl,
//   };

//   response.status(200).json(ps);
// });

app.get("/test-logs", (req, res) => {
  withActiveSpan("otel-context-added-test", async () => {
    logger.info({ test: "otel-logsddd" }, "Testing OpenTelemetry logs");
  });

  res.json({ ok: true });
});

const { sessionRouter } = createSessionRoutes();
const { userRouter } = createUserRoutes();
const { convoRouter } = createRoutes(controllers);
app.use(sessionRouter);
app.use(userRouter);
app.use(convoRouter);

// app.post(
//   "/api/conversation",
//   validate("body", ConversationSchema),
//   async (req: Request, res: Response) => {
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();

//     res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

//     const sendResponse: SendResponse = (...args) => {
//       const createdAt = new Date().toISOString();
//       const message: Message =
//         args[0] === "text"
//           ? {
//               role: "assistant",
//               type: args[0],
//               content: args[1],
//               createdAt,
//             }
//           : {
//               role: "assistant",
//               type: args[0],
//               content: args[1],
//               createdAt,
//             };
//       messageHistory.push(message);
//       res.write(`data: ${JSON.stringify(message)}\n\n`);
//     };

//     const endResponse = () => {
//       res.end();
//     };

//     res.on("close", () => {
//       res.end();
//     });
//     const { message } = req.body as TConversationSchema;
//     messageHistory.push({
//       role: "user",
//       type: "text",
//       content: message,
//       createdAt: new Date().toISOString(),
//     });

//     const harness = new Harness(message, sendResponse, endResponse);
//     await harness.executeTask();
//   },
// );

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      code: err.errorCode,
      message: err.message,
    });
  }
  logger.error(err);
  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message:
      err instanceof Error ? err.message : "Something went wrong on our end.",
  });
});
export default app;
export { app };
