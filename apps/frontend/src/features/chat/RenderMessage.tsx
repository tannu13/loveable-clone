import type { Message } from "@repo/shared";
import { isQnAAnswerList, QnAAnswerMessage } from "./QnAAnswerMessage";
import { PlanMessage } from "./PlanMessage";
import { QnAMessage } from "./QnAMessage";

type ToolStatusContent = { kind: "tool-status"; text: string };

// Mirrors ToolStatusPayloadSchema in @repo/shared — a tool call's one-line
// status announcement, tagged so it's never confused with the LLM's own
// streamed narrative text (both arrive as type: "text" frames).
function isToolStatusContent(content: unknown): content is ToolStatusContent {
  if (typeof content !== "object" || content === null) {
    return false;
  }

  const candidate = content as { kind?: unknown; text?: unknown };
  return candidate.kind === "tool-status" && typeof candidate.text === "string";
}

export function RenderMessage({
  conversationId,
  isStickyPlan = false,
  message,
}: {
  conversationId: string | undefined;
  isStickyPlan?: boolean;
  message: Message;
}) {
  if (message.type === "text" && isToolStatusContent(message.content)) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[82%] rounded-md border border-(--border) bg-(--control) px-3 py-1.5 text-xs italic text-(--muted)">
          {message.content.text}
        </div>
      </div>
    );
  }

  if (message.type === "qna" && message.role === "assistant") {
    return (
      <QnAMessage content={message.content} conversationId={conversationId} />
    );
  } else if (message.type === "qna" && isQnAAnswerList(message.content)) {
    // The paired "user answered" row — role: "user", type: "qna" — never
    // streams live; it only ever shows up via history. Its content is the
    // raw answers array, formatted as one question/answer list per bubble.
    return <QnAAnswerMessage answers={message.content} />;
  } else if (message.type === "plan") {
    return (
      <div className={isStickyPlan ? "sticky bottom-0 z-10 py-1" : ""}>
        <PlanMessage content={message.content} isSticky={isStickyPlan} />
      </div>
    );
  }

  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content, null, 2);

  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
          message.role === "user"
            ? "bg-(--accent) text-white"
            : "border border-(--border) bg-(--chat-bubble) text-(--text)"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
