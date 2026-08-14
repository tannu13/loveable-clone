import type { Message, ProjectSnapshot } from "@repo/shared";
import { apiFetch } from "../lib/api";

export type ConversationDetails = ProjectSnapshot & {
  conversationId: string;
  hasStartedBuildingApp: boolean;
};

export type ConversationDetailsResponse = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  title: string | null;
  hasStartedBuildingApp: boolean;
  messageHistory: Array<{
    type: Message["type"];
    createdAt: string;
    role: Message["role"];
    content: string;
    metadata: unknown;
  }>;
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchProjectSnapshot(): Promise<ProjectSnapshot> {
  const response = await apiFetch("/api/project");

  if (!response.ok) {
    throw new Error(`Failed to load project: ${response.status}`);
  }

  return response.json() as Promise<ProjectSnapshot>;
}

export async function fetchConversationDetails(
  conversationId: string,
): Promise<ConversationDetails> {
  const response = await apiFetch(
    `/api/conversation/${encodeURIComponent(conversationId)}`,
  );

  if (!response.ok) {
    throw new HttpError(
      `Failed to load conversation: ${response.status}`,
      response.status,
    );
  }

  const payload = (await response.json()) as ConversationDetailsResponse;

  return {
    conversationId: payload.id,
    files: [],
    hasStartedBuildingApp: payload.hasStartedBuildingApp,
    messageHistory: payload.messageHistory.map((message) => ({
      content: message.content,
      createdAt: new Date(message.createdAt).toISOString(),
      role: message.role,
      type: message.type,
    })),
    previewUrl: "",
    summary: payload.title ?? "Project conversation",
    updatedAt: new Date(payload.updatedAt).toISOString(),
  };
}
