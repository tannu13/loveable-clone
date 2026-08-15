import type { Message } from "@repo/shared";
import {
  type KeyboardEventHandler,
  type SubmitEventHandler,
  useRef,
  useState,
} from "react";
import { EmptyState } from "../../components/EmptyState";
import type { UserIdentity } from "../../lib/identity";
import { IdentityPanel } from "../identity/IdentityPanel";
import { buildRenderableMessages } from "./renderableMessages";
import { RenderMessage } from "./RenderMessage";
import { StreamingIndicator } from "./StreamingIndicator";

export function ChatPanel({
  conversationId,
  error,
  identity,
  isLoading,
  isStreaming,
  messages,
  onIdentityChange,
  onSendMessage,
  variant = "sidebar",
}: {
  conversationId: string | undefined;
  error: Error | null;
  identity: UserIdentity;
  isLoading: boolean;
  isStreaming: boolean;
  messages: Message[];
  onIdentityChange: (identity: UserIdentity) => void;
  onSendMessage: (message: string) => void;
  variant?: "sidebar" | "standalone";
}) {
  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const canSend = prompt.trim().length > 0;
  const renderableMessages = buildRenderableMessages(messages);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const message = prompt.trim();

    if (!message) {
      return;
    }

    setPrompt("");
    onSendMessage(message);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (
    event,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <aside
      className={
        variant === "standalone"
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-(--panel)"
          : "flex min-h-0 flex-col overflow-hidden border-t border-(--border) bg-(--panel) lg:border-l lg:border-t-0"
      }
    >
      <IdentityPanel identity={identity} onIdentityChange={onIdentityChange} />

      <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--border) px-4">
        <div>
          <h2 className="text-sm font-semibold">Assistant</h2>
          <p className="text-xs text-(--muted)">Project conversation</p>
        </div>
        <span className="rounded-full bg-(--success-soft) px-2.5 py-1 text-xs font-medium text-(--success)">
          {isStreaming ? "Working" : "Ready"}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-5">
        {isLoading ? (
          <EmptyState title="Loading messages" />
        ) : renderableMessages.length === 0 ? (
          <EmptyState
            title="No conversation yet"
            detail="Messages from the project API will appear here."
          />
        ) : (
          <>
            {renderableMessages.map(({ isStickyPlan, message }, index) => (
              <RenderMessage
                conversationId={conversationId}
                key={`${message.role}-${message.createdAt}-${index}`}
                isStickyPlan={isStickyPlan}
                message={message}
              />
            ))}
            {isStreaming ? <StreamingIndicator /> : null}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="border-t border-(--border) p-4" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="prompt">
          Message
        </label>
        <div className="rounded-lg border border-(--border) bg-(--control) p-2 focus-within:border-(--accent)">
          <textarea
            className="h-24 w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 text-(--text) outline-none placeholder:text-(--muted)"
            id="prompt"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the assistant to change the UI..."
            value={prompt}
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="min-w-0 truncate text-xs text-(--muted)">
              {error
                ? error.message
                : isStreaming
                  ? "Streaming response..."
                  : "Ready to send"}
            </span>
            <button
              className="h-9 rounded-lg bg-(--accent) px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!canSend}
              type="submit"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
