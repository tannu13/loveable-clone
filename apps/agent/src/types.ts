import type { Content } from "@google/genai";
import type { Message } from "@repo/shared";

export type SendResponse = (
  type: Message["type"],
  payload: Message["content"],
) => void;
export type EndResponse = (history: Content[]) => Promise<void>;
