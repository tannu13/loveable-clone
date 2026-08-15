import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchConversations,
  type ConversationSummary,
} from "../../api/conversations";
import { EmptyState } from "../../components/EmptyState";
import { ConversationMenu } from "./ConversationMenu";
import { DeleteConversationDialog } from "./DeleteConversationDialog";
import { RenameConversationDialog } from "./RenameConversationDialog";

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (absMs >= ms) {
      return relativeTimeFormatter.format(Math.round(diffMs / ms), unit);
    }
  }

  return relativeTimeFormatter.format(Math.round(diffMs / 1000), "second");
}

function CollapseIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M15 10l-2 2 2 2" />
    </svg>
  );
}

export function ConversationSidebar({
  activeConversationId,
}: {
  activeConversationId: string | undefined;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [renamingConversation, setRenamingConversation] =
    useState<ConversationSummary | null>(null);
  const [deletingConversation, setDeletingConversation] =
    useState<ConversationSummary | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });

  const conversations = conversationsQuery.data ?? [];

  const handleRenamed = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (renamingConversation) {
      void queryClient.invalidateQueries({
        queryKey: ["conversation-details", renamingConversation.id],
      });
    }
    setRenamingConversation(null);
  };

  const handleDeleted = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });

    if (deletingConversation?.id === activeConversationId) {
      navigate("/");
    }

    setDeletingConversation(null);
  };

  return (
    <>
      <aside
        className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-(--border) bg-(--panel) transition-[width] duration-200 ${
          isCollapsed ? "w-12" : "w-64"
        }`}
      >
        <div
          className={`flex h-11 shrink-0 items-center border-b border-(--border) px-2 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {isCollapsed ? null : (
            <h2 className="truncate px-1 text-xs font-semibold uppercase tracking-wide text-(--muted)">
              Conversations
            </h2>
          )}
          <button
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-7 shrink-0 place-items-center rounded-md text-(--muted) transition hover:bg-(--control) hover:text-(--text)"
            onClick={() => setIsCollapsed((current) => !current)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <CollapseIcon isCollapsed={isCollapsed} />
          </button>
        </div>

        {isCollapsed ? null : (
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversationsQuery.isLoading ? (
              <EmptyState title="Loading conversations" />
            ) : conversationsQuery.isError ? (
              <EmptyState
                detail="Failed to load conversations."
                title="Something went wrong"
              />
            ) : conversations.length === 0 ? (
              <EmptyState
                detail="Start a new conversation to see it here."
                title="No conversations yet"
              />
            ) : (
              <ul className="space-y-1">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;

                  return (
                    <li
                      className={`flex items-center gap-1 rounded-md pr-1 transition ${
                        isActive
                          ? "bg-(--control-active) text-(--text)"
                          : "text-(--text) hover:bg-(--control)"
                      }`}
                      key={conversation.id}
                    >
                      <Link
                        className="min-w-0 flex-1 px-2.5 py-2 text-sm"
                        to={`/${conversation.id}`}
                      >
                        <p className="truncate font-medium leading-5">
                          {conversation.title || "New conversation"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-(--muted)">
                          {formatRelativeTime(conversation.updatedAt)}
                        </p>
                      </Link>
                      <ConversationMenu
                        onDelete={() => setDeletingConversation(conversation)}
                        onRename={() => setRenamingConversation(conversation)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        )}
      </aside>

      {renamingConversation ? (
        <RenameConversationDialog
          conversationId={renamingConversation.id}
          currentTitle={renamingConversation.title ?? ""}
          onClose={() => setRenamingConversation(null)}
          onRenamed={handleRenamed}
        />
      ) : null}

      {deletingConversation ? (
        <DeleteConversationDialog
          conversationId={deletingConversation.id}
          onClose={() => setDeletingConversation(null)}
          onDeleted={handleDeleted}
          title={deletingConversation.title || "New conversation"}
        />
      ) : null}
    </>
  );
}
