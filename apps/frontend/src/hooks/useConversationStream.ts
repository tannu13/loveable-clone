import type { Message } from "@repo/shared";
import { useEffect, useRef, useState } from "react";
import { appendStreamFrame, isStreamDoneFrame } from "../features/chat/messageStream";
import { apiFetch } from "../lib/api";
import { conversationSocketClient } from "../lib/websocket/conversationSocketClient";

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

export function useConversationStream(conversationId?: string) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ConversationStreamState>({
    error: null,
    isStreaming: false,
    streamedMessages: [],
  });

  useEffect(() => {
    if (!conversationId) {
      conversationSocketClient.disconnect();
      return;
    }

    conversationSocketClient.connect(conversationId);

    const unsubscribe = conversationSocketClient.subscribe({
      onMessage: (frame) => {
        if (frame.conversationId !== conversationId) {
          return;
        }

        if (isStreamDoneFrame(frame)) {
          setState((current) => ({ ...current, isStreaming: false }));
          return;
        }

        setState((current) => ({
          ...current,
          isStreaming: true,
          streamedMessages: appendStreamFrame(current.streamedMessages, frame),
        }));
      },
      onError: () => {
        setState((current) => ({
          ...current,
          error: new Error("Conversation websocket connection failed"),
          isStreaming: false,
        }));
      },
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  const sendMessage = async (
    message: string,
    options: ConversationStreamOptions = {},
  ) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const userMessage = createMessage("user", trimmedMessage);

    setState((current) => ({
      error: null,
      isStreaming: true,
      streamedMessages: [...current.streamedMessages, userMessage],
    }));

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

      conversationSocketClient.connect(payload.conversationId);
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
  };

  return {
    ...state,
    sendMessage,
  };
}
