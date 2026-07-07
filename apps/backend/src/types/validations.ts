import z from "zod";

export const ConversationSchema = z.object({
  message: z.string().min(1, "Message is mandatory for the conversation"),
});
export type TConversationSchema = z.infer<typeof ConversationSchema>;
