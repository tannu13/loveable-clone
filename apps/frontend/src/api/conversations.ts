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
  previewUrl: string;
  messageHistory: Array<{
    type: Message["type"];
    createdAt: string;
    role: Message["role"];
    content: string;
    metadata: unknown;
  }>;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  hasStartedBuildingApp: boolean;
  createdAt: string;
  updatedAt: string;
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const response = await apiFetch("/api/conversation");

  if (!response.ok) {
    throw new HttpError(
      `Failed to load conversations: ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as ConversationSummary[];
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<void> {
  const response = await apiFetch(
    `/api/conversation/${encodeURIComponent(conversationId)}`,
    {
      body: JSON.stringify({ title }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new HttpError(
      `Failed to rename conversation: ${response.status}`,
      response.status,
    );
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await apiFetch(
    `/api/conversation/${encodeURIComponent(conversationId)}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new HttpError(
      `Failed to delete conversation: ${response.status}`,
      response.status,
    );
  }
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
    previewUrl: payload.previewUrl,
    summary: payload.title ?? "Project conversation",
    updatedAt: new Date(payload.updatedAt).toISOString(),
  };
}
