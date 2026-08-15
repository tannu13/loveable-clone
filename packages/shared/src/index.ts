import z from "zod";

export type ProjectFile = {
  path: string;
};

// Job kinds accepted on the backend -> agent request queue (convo-request-*).
// "list_files"/"read_file" are handled directly by the agent's WorkerService
// without going through the LLM harness.
const JobTypes = z.enum(["text", "qna", "plan", "list_files", "read_file"]);
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

export const QnASchema = z.object({
  summary: z.string().min(1, "Summary is mandatory"),
  questions: z.array(
    z.object({
      question: z.string().min(1, "Question statement should not be empty"),
      inputType: z.literal("select"),
      options: z.array(z.string().min(1, "Option should have text")),
    }),
  ),
});
export const CorrelationIdSchema = z.object({
  correlationId: z.string().min(1),
});
export const QnASchemaWithCorrelationId = QnASchema.extend(
  CorrelationIdSchema.shape,
);

export const QnAReplySchema = z.object({
  answers: z.unknown(),
  correlationId: z.string().min(1),
});
export type TQnAReplySchema = z.infer<typeof QnAReplySchema>;

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

export { getMainRepoPath } from "./helpers";
