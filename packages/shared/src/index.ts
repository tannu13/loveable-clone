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
type QnaMessage = {
  role: "user" | "assistant";
  type: "qna";
  content: unknown;
  createdAt: string;
};
type PlanMessage = {
  role: "user" | "assistant";
  type: "plan";
  content: unknown;
  createdAt: string;
};
export type Message = TextMessage | QnaMessage | PlanMessage;
export type MessageType = Message["type"];
export type MessageContent<TType extends MessageType> = Extract<
  Message,
  { type: TType }
>["content"];
export type SendResponseArgs = {
  [TType in MessageType]: [type: TType, payload: MessageContent<TType>];
}[MessageType];
export type SendResponse = (...args: SendResponseArgs) => void;

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
