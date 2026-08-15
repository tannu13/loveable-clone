import { qnaAskCodec, planAskCodec, type Message } from "@repo/shared";
import type { TMessageRoleEnum, TMessageTypeEnum } from "@repo/db/schema";

type MessageHistoryRow = {
  content: string;
  role: TMessageRoleEnum;
  type: TMessageTypeEnum;
  metadata: unknown;
  createdAt: Date;
};

// Reconstructs each persisted `message_history` row into the same shape the
// frontend already knows how to render from live websocket frames (see the
// message codecs in @repo/shared). GET /api/conversation/:id should never
// hand back the raw `content`/`metadata` DB columns as if they were the
// wire format — that split is a storage detail, not part of the contract
// with clients.
export function toWireMessages(rows: MessageHistoryRow[]): Message[] {
  return rows.map((row) => ({
    role: row.role,
    type: row.type,
    content: toWireContent(row),
    createdAt: row.createdAt.toISOString(),
  }));
}

function toWireContent(row: MessageHistoryRow): unknown {
  if (row.type === "qna") {
    // The "ask" (assistant) row's payload lives in `metadata`; reconstruct
    // it through the codec so it matches the live emit shape, including
    // `correlationId: null` for rows persisted before the fix (rendered
    // read-only/expired by the frontend).
    if (row.role === "assistant") {
      return qnaAskCodec.fromRow(row) ?? row.metadata ?? row.content;
    }

    // The "answer" (user) row is never streamed live in the first place —
    // its `metadata` holds the raw answers, which is fine to hand back as-is.
    return row.metadata ?? row.content;
  }

  if (row.type === "plan") {
    return planAskCodec.fromRow(row) ?? row.content;
  }

  return row.content;
}
