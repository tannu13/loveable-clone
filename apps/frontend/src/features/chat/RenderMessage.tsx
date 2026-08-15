import type { Message } from "@repo/shared";
import { PlanMessage } from "./PlanMessage";
import { QnAMessage } from "./QnAMessage";

export function RenderMessage({
  conversationId,
  isStickyPlan = false,
  message,
}: {
  conversationId: string | undefined;
  isStickyPlan?: boolean;
  message: Message;
}) {
  if (message.type === "qna" && message.role === "assistant") {
    // The paired "user answered" row (role: "user", type: "qna") never
    // streams live and isn't a question to render as a card — it falls
    // through to the generic bubble below like any other message.
    return (
      <QnAMessage content={message.content} conversationId={conversationId} />
    );
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
