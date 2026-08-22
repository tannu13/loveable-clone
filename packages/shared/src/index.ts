import z from "zod";

export type ProjectFile = {
  path: string;
};

// Job kinds accepted on the backend -> agent request queue (convo-request-*).
// "list_files"/"read_file" are handled directly by the agent's WorkerService
// without going through the LLM harness.
const JobTypes = z.enum([
  "text",
  "qna",
  "plan",
  "list_files",
  "read_file",
  "initiate_shutdown",
]);
export const RedisMessageSchema = z.object({
  conversationId: z.string().min(1),
  type: JobTypes,
  message: z.unknown(),
});
export type TRedisMessageSchema = z.infer<typeof RedisMessageSchema>;
export type Message = {
  role: "user" | "assistant";
  type: "text" | "qna" | "plan";
  content: unknown;
  createdAt: string;
};

export type ProjectSnapshot = {
  summary: string;
  messageHistory: Message[];
  files: ProjectFile[];
  updatedAt: string;
  previewUrl: string;
};

// A tool-call's one-line status announcement (e.g. "Reading file @ x"),
// streamed live as a `type: "text"` frame alongside the LLM's own narrative
// text chunks. It's tagged with `kind: "tool-status"` specifically so it's
// never mistaken for LLM output: the frontend's frame-merging logic only
// concatenates consecutive *string* "text" payloads into one bubble, so a
// tagged object payload here both renders as its own distinct message and
// stops the next real text chunk from merging onto whatever tool status
// happened to stream last (see apps/frontend's messageStream.ts). This is
// live-only, ephemeral status — unlike Message["type"], it's never written
// to `message_history` (there's no Postgres enum value for it, deliberately;
// see the WorkspaceFrameTypes comment below for the same reasoning).
export const ToolStatusPayloadSchema = z.object({
  kind: z.literal("tool-status"),
  text: z.string().min(1),
});
export type ToolStatusPayload = z.infer<typeof ToolStatusPayloadSchema>;

export const QnAQuestionSchema = z.object({
  question: z.string().min(1, "Question statement should not be empty"),
  inputType: z.literal("select"),
  options: z.array(z.string().min(1, "Option should have text")),
});
export type QnAQuestion = z.infer<typeof QnAQuestionSchema>;

export const QnASchema = z.object({
  summary: z.string().min(1, "Summary is mandatory"),
  questions: z.array(QnAQuestionSchema),
});

export const QnAReplySchema = z.object({
  answers: z.unknown(),
  correlationId: z.string().min(1),
});
export type TQnAReplySchema = z.infer<typeof QnAReplySchema>;

// --- Message codecs ---------------------------------------------------
//
// A "message codec" is the single source of truth for how a chat message
// type's payload maps onto the `message_history` row (`content`/`metadata`
// columns). It closes the gap that used to exist between the live shape
// published over the websocket and the shape persisted/read back from
// Postgres: both the agent (write side) and the backend (read side) build
// their payload through the same `toRow`/`fromRow` pair, so the two can't
// drift out of sync the way the qna payload previously did (correlationId
// was published live but silently dropped on the way into `metadata`).
//
// Adding a new stateful tool response (beyond qna/plan) means adding one
// codec here, not hand-rolling a write path in the agent and a read path in
// the backend and hoping they agree.
export type MessageRow = {
  content: string;
  metadata: unknown;
};

// The canonical "ask" payload for a qna message — exactly what's published
// live over the websocket, and what a persisted "qna"/"assistant" row is
// reconstructed back into for GET /api/conversation/:id.
export const QnAAskPayloadSchema = z.object({
  correlationId: z.string().min(1),
  questions: z.array(QnAQuestionSchema).min(1),
});
export type QnAAskPayload = z.infer<typeof QnAAskPayloadSchema>;

// Rows persisted before `metadata` included `correlationId` store a bare
// questions array. Such a questionnaire can never be answered again (the
// correlationId needed to resolve it is gone), so `fromRow` reports it back
// with `correlationId: null` — callers should render that as read-only /
// expired rather than as a live, submittable question.
const LegacyQnAQuestionsSchema = z.array(QnAQuestionSchema).min(1);

export type QnAAskWirePayload = {
  correlationId: string | null;
  questions: QnAQuestion[];
};

export const qnaAskCodec = {
  toRow: (payload: QnAAskPayload): MessageRow => ({
    content: "",
    metadata: payload,
  }),
  fromRow: (row: MessageRow): QnAAskWirePayload | null => {
    const current = QnAAskPayloadSchema.safeParse(row.metadata);
    if (current.success) {
      return current.data;
    }

    const legacy = LegacyQnAQuestionsSchema.safeParse(row.metadata);
    if (legacy.success) {
      return { correlationId: null, questions: legacy.data };
    }

    return null;
  },
};

const PlanStepSchema = z.object({
  step: z.string().min(1, "Step for each plan item is mandatory"),
  status: z.enum(["pending", "in_progress", "completed"]),
});

// The canonical "ask" payload for a plan message — mirrors qnaAskCodec.
// Nothing is dropped on the way into the DB here (explanation -> content,
// plan -> metadata), so `fromRow` can always losslessly reconstruct it,
// unlike qna's correlationId.
export const PlanAskPayloadSchema = z.object({
  explanation: z.string().optional(),
  plan: z.array(PlanStepSchema).min(1),
});
export type PlanAskPayload = z.infer<typeof PlanAskPayloadSchema>;

export const planAskCodec = {
  toRow: (payload: PlanAskPayload): MessageRow => ({
    content: payload.explanation ?? "",
    metadata: payload.plan,
  }),
  fromRow: (row: MessageRow): PlanAskPayload | null => {
    const parsed = PlanAskPayloadSchema.safeParse({
      explanation: row.content || undefined,
      plan: row.metadata,
    });
    return parsed.success ? parsed.data : null;
  },
};

// Request to read a single project file (agent job payload for "read_file").
// No correlation id: a path is already a natural, idempotent key on its own
// (unlike QnA, re-requesting the same path is expected to return the same
// answer, so there's nothing a manufactured id would add).
export const ReadFileRequestSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
});
export type TReadFileRequestSchema = z.infer<typeof ReadFileRequestSchema>;

// Outbound frame kinds published by the agent for on-demand workspace/file
// browsing. Kept distinct from chat Message["type"] so these never enter
// chat rendering or get persisted via saveToDB (Message["type"] is backed by
// a Postgres enum restricted to "text" | "qna" | "plan").
export const WorkspaceFrameTypes = z.enum([
  "file_list",
  "file_content",
  "workspace_error",
]);
export type WorkspaceFrameType = z.infer<typeof WorkspaceFrameTypes>;

export type FileListFramePayload = {
  files: ProjectFile[];
};
export type FileContentFramePayload = {
  path: string;
  content: string;
};
// `path` is present when the error came from a "read_file" job (so the
// frontend can match it to the request awaiting that path) and absent when
// it came from "list_files" (which has nothing to key on but the list itself).
export type WorkspaceErrorFramePayload = {
  path?: string;
  message: string;
};

// Everything that can actually arrive on the conversation websocket wire.
export type ConversationStreamFrameType = Message["type"] | WorkspaceFrameType;

export const LifeCycleWorkerCommsSchema = z.object({
  type: z.enum(["shutdown_ready"]),
  conversationId: z.uuid(),
});
export type TLifeCycleWorkerComms = z.infer<typeof LifeCycleWorkerCommsSchema>;

export {
  getMainRepoPath,
  getMessageToAgentQueueName,
  getLifecycleWorkerQueueName,
  getConversationHeartbeatName,
} from "./helpers";
