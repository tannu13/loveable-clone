import type { Message } from "@repo/shared";
import { useCallback, useRef, useState } from "react";

type ConversationStreamOptions = {
  onComplete?: () => Promise<void> | void;
};

type ConversationStreamState = {
  error: Error | null;
  isStreaming: boolean;
  streamedMessages: Message[];
};

function createMessage(role: Message["role"], content: string): Message {
  return {
    role,
    type: "text",
    content,
    createdAt: new Date().toISOString(),
  };
}

function parseSseEvent(event: string): string | null {
  const dataLines: string[] = [];

  for (const line of event.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      const value = line.slice("data:".length);
      dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
      continue;
    }

    if (dataLines.length > 0) {
      dataLines.push(line);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join("\n");
}

function isConnectionAck(payload: string): boolean {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "connected" in parsed &&
      parsed.connected === true
    );
  } catch {
    return false;
  }
}

function parseAsJsonOrThrow(str: string) {
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error(`Unable to parse ${str}`);
  }
}

async function readEventStream(
  response: Response,
  onMessage: (message: Message) => void,
): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Conversation response did not include a stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      let payload = parseSseEvent(event);

      if (payload && !isConnectionAck(payload)) {
        onMessage(parseAsJsonOrThrow(payload));
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const payload = parseSseEvent(buffer);

    if (payload && !isConnectionAck(payload)) {
      onMessage(parseAsJsonOrThrow(payload));
    }
  }
}

export function useConversationStream() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ConversationStreamState>({
    error: null,
    isStreaming: false,
    streamedMessages: [],
  });

  const sendMessage = useCallback(
    async (message: string, options: ConversationStreamOptions = {}) => {
      const trimmedMessage = message.trim();

      if (!trimmedMessage) {
        return;
      }

      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        error: null,
        isStreaming: true,
        streamedMessages: [createMessage("user", trimmedMessage)],
      });

      try {
        const response = await fetch("/api/conversation", {
          body: JSON.stringify({ message: trimmedMessage }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Conversation failed: ${response.status}`);
        }

        await readEventStream(response, (message) => {
          setState((current) => ({
            ...current,
            streamedMessages: [...current.streamedMessages, message],
          }));
        });

        await options.onComplete?.();

        setState((current) => ({
          ...current,
          error: null,
          isStreaming: false,
          streamedMessages: [],
        }));
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
    [],
  );

  return {
    ...state,
    sendMessage,
  };
}
