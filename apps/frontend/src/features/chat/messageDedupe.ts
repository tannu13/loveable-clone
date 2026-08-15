import type { Message } from "@repo/shared";

// Streamed messages don't carry a stable id that maps onto a
// `message_history` row, so role + type + content equality is the best
// available signal for "this is the same message twice".
function messageKey(message: Message): string {
  return JSON.stringify([message.role, message.type, message.content]);
}

/**
 * Combines persisted history with the live/optimistic stream, dropping any
 * streamed message that's already represented in history.
 *
 * Two places can otherwise double up a message: sending the very first
 * message of a brand-new conversation shows it immediately via the
 * optimistic entry useConversationStream adds to `streamedMessages`, and
 * shortly after, the conversation-details query refetches (triggered by the
 * navigation to the new conversation's URL) and brings that same message
 * back via `messageHistory` once it's persisted. The same race can also
 * happen mid-conversation if `projectQuery.refetch()` runs while a message
 * is still only in the stream (e.g. an identity change during an active
 * turn). Matching is done as a multiset (consuming one history occurrence
 * per match) so genuinely repeated identical messages — the user sending
 * the same text twice — aren't under-counted.
 */
export function mergeMessageHistory(
  history: Message[],
  streamed: Message[],
): Message[] {
  const remaining = new Map<string, number>();

  for (const message of history) {
    const key = messageKey(message);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const deduped = streamed.filter((message) => {
    const key = messageKey(message);
    const count = remaining.get(key) ?? 0;

    if (count <= 0) {
      return true;
    }

    remaining.set(key, count - 1);
    return false;
  });

  return [...history, ...deduped];
}
