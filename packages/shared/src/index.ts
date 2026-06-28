import z from "zod";

export type ProjectFile = {
  path: string;
  content: string;
};

// type MessageType = "text" | "qna" | "plan";
type TextMessage = {
  role: "user" | "assistant";
  type: "text";
  content: string;
  createdAt: string;
};
type NonTextMessage = {
  role: "user" | "assistant";
  type: "qna" | "plan";
  content: unknown;
  createdAt: string;
};
export type Message = TextMessage | NonTextMessage;

export type ProjectSnapshot = {
  summary: string;
  messageHistory: Message[];
  files: ProjectFile[];
  updatedAt: string;
  previewUrl: string;
};

export const QnASchema = z.object({
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
