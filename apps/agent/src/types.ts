import type { Content } from "@google/genai";

export type EndResponse = (history: Content[]) => Promise<void>;
