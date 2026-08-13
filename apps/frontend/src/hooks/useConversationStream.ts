import type { Message } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

type ConversationStreamOptions = {
  conversationId?: string;
  onConversationStarted?: (details: {
    conversationId: string;
    previewUrl: string;
    userMessage: Message;
  }) => Promise<void> | void;
};

type ConversationStreamState = {
  error: Error | null;
  isStreaming: boolean;
  streamedMessages: Message[];
};

type ConversationStartResponse = {
  conversationId: string;
  previewUrl: string;
};

type WebSocketPayload = {
  conversationId?: string;
  type?: Message["type"];
  role?: Message["role"];
  payload?: unknown;
  message?: unknown;
  content?: unknown;
  createdAt?: string;
};

function createMessage(role: Message["role"], content: string): Message {
  return {
    role,
    type: "text",
    content,
    createdAt: new Date().toISOString(),
  };
}

function isConversationStartResponse(
  payload: unknown,
): payload is ConversationStartResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "conversationId" in payload &&
    typeof payload.conversationId === "string" &&
    payload.conversationId.length > 0 &&
    "previewUrl" in payload &&
    typeof payload.previewUrl === "string"
  );
}

function getConversationWebSocketUrl(conversationId: string): string {
  const configuredUrl = import.meta.env.VITE_CONVERSATION_WS_URL as
    | string
    | undefined;
  const baseUrl =
    configuredUrl ??
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${
      window.location.hostname
    }:3010`;
  const url = new URL(baseUrl);

  url.searchParams.set("conversation_id", conversationId);

  return url.toString();
}

function parseWebSocketMessage(eventData: unknown): Message | null {
  if (typeof eventData !== "string") {
    return null;
  }

  const parsed = JSON.parse(eventData) as WebSocketPayload | Message;

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "content" in parsed &&
    "createdAt" in parsed &&
    "role" in parsed &&
    "type" in parsed
  ) {
    return parsed as Message;
  }

  const payload = parsed as WebSocketPayload;

  return {
    role: payload.role ?? "assistant",
    type: payload.type ?? "text",
    content: payload.payload ?? payload.message ?? payload.content ?? "",
    createdAt: payload.createdAt ?? new Date().toISOString(),
  };
}

export function useConversationStream(conversationId?: string) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ConversationStreamState>({
    error: null,
    isStreaming: false,
    streamedMessages: [],
  });

  const connectToConversation = useCallback((nextConversationId: string) => {
    webSocketRef.current?.close();

    const websocket = new WebSocket(
      getConversationWebSocketUrl(nextConversationId),
    );
    webSocketRef.current = websocket;

    websocket.onmessage = (event) => {
      try {
        const message = parseWebSocketMessage(event.data);

        if (!message) {
          return;
        }

        setState((current) => ({
          ...current,
          isStreaming: false,
          streamedMessages: [...current.streamedMessages, message],
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error
              : new Error("Failed to read websocket message"),
          isStreaming: false,
        }));
      }
    };

    websocket.onerror = () => {
      setState((current) => ({
        ...current,
        error: new Error("Conversation websocket connection failed"),
        isStreaming: false,
      }));
    };
  }, []);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    connectToConversation(conversationId);

    return () => {
      webSocketRef.current?.close();
      webSocketRef.current = null;
    };
  }, [connectToConversation, conversationId]);

  const sendMessage = useCallback(
    async (message: string, options: ConversationStreamOptions = {}) => {
      const trimmedMessage = message.trim();

      if (!trimmedMessage) {
        return;
      }

      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const userMessage = createMessage("user", trimmedMessage);

      setState({
        error: null,
        isStreaming: true,
        streamedMessages: [userMessage],
      });

      try {
        const activeConversationId = options.conversationId ?? conversationId;
        const response = await apiFetch(
          activeConversationId
            ? `/api/conversation/${encodeURIComponent(activeConversationId)}`
            : "/api/conversation",
          {
            body: JSON.stringify({ message: trimmedMessage }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Conversation failed: ${response.status}`);
        }

        const payload = (await response.json()) as unknown;

        if (!isConversationStartResponse(payload)) {
          throw new Error("Conversation response did not include preview data");
        }

        connectToConversation(payload.conversationId);
        await options.onConversationStarted?.({ ...payload, userMessage });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            error instanceof Error ? error : new Error("Conversation failed"),
          isStreaming: false,
        }));
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [connectToConversation, conversationId],
  );

  return {
    ...state,
    sendMessage,
  };
}
