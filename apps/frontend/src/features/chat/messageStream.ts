import type { Message } from "@repo/shared";
import type { ConversationStreamFrame } from "../../lib/websocket/conversationSocketClient";

// This module only ever handles chat frames ("text"|"qna"|"plan") — workspace
// frames (file_list/file_content/workspace_error) are filtered out by
// useConversationStream.ts before reaching these functions.
export type ChatStreamFrame = ConversationStreamFrame & { type: Message["type"] };

const STREAM_DONE_PAYLOAD = "[DONE]";

export function isStreamDoneFrame(frame: ChatStreamFrame): boolean {
  return frame.type === "text" && frame.payload === STREAM_DONE_PAYLOAD;
}

function frameToMessage(frame: ChatStreamFrame): Message {
  return {
    role: "assistant",
    type: frame.type,
    content: frame.payload,
    createdAt: new Date().toISOString(),
  };
}

function canMergeIntoLastMessage(
  lastMessage: Message | undefined,
  frame: ChatStreamFrame,
): lastMessage is Message & { content: string } {
  return (
    frame.type === "text" &&
    typeof frame.payload === "string" &&
    lastMessage !== undefined &&
    lastMessage.role === "assistant" &&
    lastMessage.type === "text" &&
    typeof lastMessage.content === "string"
  );
}

/**
 * Folds one incoming stream frame into the running message list.
 *
 * Consecutive "text" frames from the assistant are concatenated onto the
 * same trailing message, so a run of streamed chunks renders as a single
 * growing bubble. Any other frame (a "qna"/"plan" payload, or a "text" frame
 * that follows one of those) starts a new message. Callers should filter out
 * `[DONE]` frames via `isStreamDoneFrame` before calling this.
 */
export function appendStreamFrame(
  messages: Message[],
  frame: ChatStreamFrame,
): Message[] {
  const lastMessage = messages[messages.length - 1];

  if (canMergeIntoLastMessage(lastMessage, frame)) {
    const mergedMessage: Message = {
      ...lastMessage,
      content: lastMessage.content + (frame.payload as string),
    };

    return [...messages.slice(0, -1), mergedMessage];
  }

  return [...messages, frameToMessage(frame)];
}
