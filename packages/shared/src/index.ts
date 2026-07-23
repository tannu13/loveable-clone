import z from "zod";

export type ProjectFile = {
  path: string;
  content: string;
};

// type MessageType = "text" | "qna" | "plan";
const MessageTypes = z.enum(["text", "qna", "plan"]);
export const RedisMessageSchema = z.object({
  conversationId: z.string().min(1),
  type: MessageTypes,
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
