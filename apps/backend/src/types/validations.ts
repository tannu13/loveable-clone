import z from "zod";

export const ConversationSchema = z.object({
  message: z.string().min(1, "Message is mandatory for the conversation"),
});
export type TConversationSchema = z.infer<typeof ConversationSchema>;

export const ClaimUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only include letters, numbers, and underscores",
    ),
});
export type TClaimUserSchema = z.infer<typeof ClaimUserSchema>;

export const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});
export type TLoginSchema = z.infer<typeof LoginSchema>;

export const ReadFileQuerySchema = z.object({
  path: z.string().min(1, "Path is mandatory"),
});
export type TReadFileQuerySchema = z.infer<typeof ReadFileQuerySchema>;
