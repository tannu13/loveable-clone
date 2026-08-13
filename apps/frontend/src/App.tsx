import type { Message, ProjectFile, ProjectSnapshot } from "@repo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type SubmitEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { QnAMessage } from "./components/QnAMessage";
import { useConversationStream } from "./hooks/useConversationStream";
import { isPlanComplete, PlanMessage } from "./components/PlanMessage";
import { apiFetch } from "./lib/api";
import {
  claimAccount,
  getStoredIdentity,
  signInWithUsername,
  type UserIdentity,
} from "./lib/identity";
import { bootstrapSession, hasStoredSessionToken } from "./lib/session";

type ViewMode = "code" | "preview";

type ConversationDetails = ProjectSnapshot & {
  conversationId: string;
};

type ConversationDetailsResponse = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  title: string | null;
  messageHistory: Array<{
    type: Message["type"];
    createdAt: string;
    role: Message["role"];
    content: string;
    metadata: unknown;
  }>;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type FileTreeRow =
  | {
      depth: number;
      kind: "folder";
      path: string;
      name: string;
    }
  | {
      depth: number;
      kind: "file";
      path: string;
      name: string;
      file: ProjectFile;
    };

async function fetchProjectSnapshot(): Promise<ProjectSnapshot> {
  const response = await apiFetch("/api/project");

  if (!response.ok) {
    throw new Error(`Failed to load project: ${response.status}`);
  }

  return response.json() as Promise<ProjectSnapshot>;
}

async function fetchConversationDetails(
  conversationId: string,
): Promise<ConversationDetails> {
  const response = await apiFetch(
    `/api/conversation/${encodeURIComponent(conversationId)}`,
  );

  if (!response.ok) {
    throw new HttpError(
      `Failed to load conversation: ${response.status}`,
      response.status,
    );
  }

  const payload = (await response.json()) as ConversationDetailsResponse;

  return {
    conversationId: payload.id,
    files: [],
    messageHistory: payload.messageHistory.map((message) => ({
      content: message.content,
      createdAt: new Date(message.createdAt).toISOString(),
      role: message.role,
      type: message.type,
    })),
    previewUrl: "",
    summary: payload.title ?? "Project conversation",
    updatedAt: new Date(payload.updatedAt).toISOString(),
  };
}

async function fetchProjectFileContent(path: string): Promise<string> {
  const response = await apiFetch(
    `/api/project/file?path=${encodeURIComponent(path)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to load file content: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return response.text();
  }

  const payload = (await response.json()) as unknown;

  if (typeof payload === "string") {
    return payload;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "content" in payload &&
    typeof payload.content === "string"
  ) {
    return payload.content;
  }

  throw new Error("File content response did not include text content");
}

function buildFileTreeRows(files: ProjectFile[]): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  const seenFolders = new Set<string>();

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);

    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join("/");
      const isFile = index === segments.length - 1;

      if (isFile) {
        rows.push({
          depth: index,
          kind: "file",
          path,
          name: segment,
          file,
        });
        return;
      }

      if (!seenFolders.has(path)) {
        seenFolders.add(path);
        rows.push({
          depth: index,
          kind: "folder",
          path,
          name: segment,
        });
      }
    });
  }

  return rows;
}

export function App() {
  return (
    <Routes>
      <Route element={<WorkspaceRoute />} path="/" />
      <Route element={<WorkspaceRoute />} path="/:conversationId" />
    </Routes>
  );
}

function WorkspaceRoute() {
  const { conversationId: routeConversationId } = useParams();
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(() => hasStoredSessionToken());
  const [viewMode, setViewMode] = useState<ViewMode>("code");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [identity, setIdentity] = useState<UserIdentity>(() =>
    getStoredIdentity(),
  );
  const queryClient = useQueryClient();

  const projectQuery = useQuery({
    enabled: hasSession,
    queryKey: routeConversationId
      ? ["conversation-details", routeConversationId]
      : ["project"],
    queryFn: () =>
      routeConversationId
        ? fetchConversationDetails(routeConversationId)
        : fetchProjectSnapshot(),
  });
  const conversationStream = useConversationStream(routeConversationId);

  useEffect(() => {
    if (
      routeConversationId &&
      projectQuery.error instanceof HttpError &&
      projectQuery.error.status === 404
    ) {
      navigate("/", { replace: true });
    }
  }, [navigate, projectQuery.error, routeConversationId]);

  const files = projectQuery.data?.files ?? [];
  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedFilePath),
    [files, selectedFilePath],
  );

  useEffect(() => {
    if (
      selectedFilePath &&
      !files.some((file) => file.path === selectedFilePath)
    ) {
      setSelectedFilePath(null);
    }
  }, [files, selectedFilePath]);

  const selectedFileContentQuery = useQuery({
    enabled: hasSession && Boolean(selectedFile?.path),
    queryKey: ["project-file-content", selectedFile?.path],
    queryFn: () => fetchProjectFileContent(selectedFile!.path),
  });

  const statusLabel = (() => {
    if (conversationStream.isStreaming) {
      return "Working";
    }

    if (projectQuery.isLoading) {
      return "Loading";
    }

    if (projectQuery.isError) {
      return "Offline";
    }

    return "Synced";
  })();

  const displayedMessages = useMemo(
    () => [
      ...(projectQuery.data?.messageHistory ?? []),
      ...conversationStream.streamedMessages,
    ],
    [conversationStream.streamedMessages, projectQuery.data?.messageHistory],
  );

  const handleSendMessage = useCallback(
    (message: string) => {
      void conversationStream.sendMessage(message, {
        conversationId: routeConversationId,
        onConversationStarted: ({
          conversationId: startedConversationId,
          previewUrl,
          userMessage,
        }) => {
          if (routeConversationId) {
            return;
          }

          queryClient.setQueryData(
            ["conversation-details", startedConversationId],
            {
              conversationId: startedConversationId,
              files: [],
              messageHistory: [],
              previewUrl,
              summary: "Project conversation",
              updatedAt: userMessage.createdAt,
            },
          );

          navigate(`/${startedConversationId}`);
        },
      });
    },
    [routeConversationId, conversationStream, navigate, queryClient],
  );

  const handleIdentityChange = useCallback(
    (nextIdentity: UserIdentity) => {
      setIdentity(nextIdentity);
      void projectQuery.refetch();
    },
    [projectQuery],
  );

  if (!hasSession) {
    return <LandingPage onStart={() => setHasSession(true)} />;
  }

  return (
    <main className="h-dvh overflow-hidden bg-(--app-bg) text-(--text)">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-(--border) bg-(--panel) px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--accent) text-sm font-bold text-white">
              L
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-5">
                Loveable Workspace
              </h1>
              <p className="hidden text-xs text-(--muted) sm:block">
                app-builder / live project
              </p>
            </div>
          </div>

          <div className="grid h-9 grid-cols-2 rounded-lg border border-(--border) bg-(--control) p-1 text-sm">
            {(["code", "preview"] as const).map((mode) => (
              <button
                className={`h-7 min-w-20 rounded-md px-3 font-medium transition ${
                  viewMode === mode
                    ? "bg-(--control-active) text-(--text) shadow-sm"
                    : "text-(--muted) hover:text-(--text)"
                }`}
                key={mode}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode === "code" ? "Code" : "Preview"}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-2 text-xs text-(--muted) md:flex">
            <span className="rounded-full border border-(--border) px-2.5 py-1">
              {statusLabel}
            </span>
            <button
              className="grid size-8 place-items-center rounded-lg border border-(--border) bg-(--control) text-(--muted) transition hover:text-(--text)"
              type="button"
              aria-label="Open settings"
            >
              ...
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,42dvh)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-1">
          <section className="min-h-0 overflow-hidden p-3 sm:p-4">
            {viewMode === "code" ? (
              <CodeWorkspace
                error={projectQuery.error}
                files={files}
                fileContent={selectedFileContentQuery.data}
                fileContentError={selectedFileContentQuery.error}
                isError={projectQuery.isError}
                isFileContentError={selectedFileContentQuery.isError}
                isFileContentLoading={selectedFileContentQuery.isLoading}
                isLoading={projectQuery.isLoading}
                onSelectFile={setSelectedFilePath}
                selectedFile={selectedFile}
              />
            ) : (
              <PreviewWorkspace
                isLoading={projectQuery.isLoading}
                previewUrl={projectQuery.data?.previewUrl ?? ""}
                reloadKey={previewReloadKey}
              />
            )}
          </section>

          <ChatPanel
            error={conversationStream.error}
            identity={identity}
            isLoading={projectQuery.isLoading}
            isStreaming={conversationStream.isStreaming}
            messages={displayedMessages}
            onIdentityChange={handleIdentityChange}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>
    </main>
  );
}

function LandingPage({ onStart }: { onStart: () => void }) {
  const [error, setError] = useState<Error | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (isStarting) {
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      await bootstrapSession();
      onStart();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError
          : new Error("Failed to start session"),
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-(--app-bg) px-4 text-(--text)">
      <section className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">
          Build apps with AI
        </h1>
        <button
          className="mt-8 h-11 rounded-lg bg-(--accent) px-5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isStarting}
          onClick={handleStart}
          type="button"
        >
          {isStarting ? "Starting" : "Start Building"}
        </button>
        {error ? (
          <p className="mt-4 text-sm leading-6 text-red-500">{error.message}</p>
        ) : null}
      </section>
    </main>
  );
}

function CodeWorkspace({
  error,
  files,
  fileContent,
  fileContentError,
  isError,
  isFileContentError,
  isFileContentLoading,
  isLoading,
  onSelectFile,
  selectedFile,
}: {
  error: Error | null;
  files: ProjectFile[];
  fileContent?: string;
  fileContentError: Error | null;
  isError: boolean;
  isFileContentError: boolean;
  isFileContentLoading: boolean;
  isLoading: boolean;
  onSelectFile: (path: string) => void;
  selectedFile?: ProjectFile;
}) {
  const treeRows = useMemo(() => buildFileTreeRows(files), [files]);
  const codeLines = fileContent?.split("\n") ?? [];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-lg border border-(--border) bg-(--panel)">
        <div className="flex h-11 items-center justify-between border-b border-(--border) px-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
            Files
          </span>
          <span className="text-xs text-(--muted)">{files.length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {isLoading ? (
            <EmptyState title="Loading project files" />
          ) : isError ? (
            <EmptyState
              title="Could not load project"
              detail={error?.message}
            />
          ) : treeRows.length === 0 ? (
            <EmptyState title="No files returned" />
          ) : (
            treeRows.map((row) =>
              row.kind === "folder" ? (
                <div
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-(--muted)"
                  key={`folder-${row.path}`}
                  style={{ paddingLeft: `${row.depth * 18 + 8}px` }}
                >
                  <span className="w-4 text-center text-xs">&gt;</span>
                  <span className="truncate">{row.name}</span>
                </div>
              ) : (
                <button
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition ${
                    selectedFile?.path === row.path
                      ? "bg-(--selected) text-(--text)"
                      : "text-(--muted) hover:bg-(--control) hover:text-(--text)"
                  }`}
                  key={`file-${row.path}`}
                  onClick={() => onSelectFile(row.path)}
                  style={{ paddingLeft: `${row.depth * 18 + 8}px` }}
                  type="button"
                >
                  <span className="w-4 text-center text-xs">-</span>
                  <span className="truncate">{row.name}</span>
                </button>
              ),
            )
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-lg border border-(--border) bg-(--editor)">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-(--border) px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 rounded-full bg-(--accent)" />
            <span className="truncate text-sm font-medium">
              {selectedFile?.path ?? "No file selected"}
            </span>
          </div>
          <span className="text-xs text-(--muted)">
            {selectedFile && fileContent ? `${codeLines.length} lines` : "Project"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6">
          {isLoading ? (
            <EmptyState title="Loading code" />
          ) : isError ? (
            <EmptyState
              title="Unable to read project"
              detail={error?.message}
            />
          ) : !selectedFile ? (
            <EmptyState title="Select a file to view its code" />
          ) : isFileContentLoading ? (
            <EmptyState title="Loading file content" />
          ) : isFileContentError ? (
            <EmptyState
              title="Unable to read file"
              detail={fileContentError?.message}
            />
          ) : (
            codeLines.map((line, index) => (
              <div
                className="grid grid-cols-[2.5rem_minmax(max-content,1fr)]"
                key={`${selectedFile.path}-${index}`}
              >
                <span className="select-none pr-4 text-right text-(--line-number)">
                  {index + 1}
                </span>
                <code className="whitespace-pre text-(--code)">{line}</code>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PreviewWorkspace({
  isLoading,
  previewUrl,
  reloadKey,
}: {
  isLoading: boolean;
  previewUrl: string;
  reloadKey: number;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-(--border) bg-(--panel)">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-(--border) px-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-red-400" />
          <span className="size-3 rounded-full bg-yellow-400" />
          <span className="size-3 rounded-full bg-green-400" />
        </div>
        <span className="truncate rounded-full bg-(--control) px-3 py-1 text-xs text-(--muted)">
          {previewUrl || "No preview URL"}
        </span>
        <span className="hidden text-xs text-(--muted) sm:block">Live app</span>
      </div>

      <div className="min-h-0 flex-1 bg-(--preview-bg) p-3 sm:p-4">
        {isLoading ? (
          <div className="grid h-full place-items-center rounded-lg border border-(--preview-border) bg-(--preview-surface)">
            <EmptyState title="Loading preview" />
          </div>
        ) : previewUrl ? (
          <iframe
            className="h-full w-full rounded-lg border border-(--preview-border) bg-white"
            key={`${previewUrl}-${reloadKey}`}
            src={previewUrl}
            title="Project preview"
          />
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-(--preview-border) bg-(--preview-surface)">
            <EmptyState title="No preview URL returned" />
          </div>
        )}
      </div>
    </section>
  );
}

function ChatPanel({
  error,
  identity,
  isLoading,
  isStreaming,
  messages,
  onIdentityChange,
  onSendMessage,
}: {
  error: Error | null;
  identity: UserIdentity;
  isLoading: boolean;
  isStreaming: boolean;
  messages: Message[];
  onIdentityChange: (identity: UserIdentity) => void;
  onSendMessage: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const canSend = prompt.trim().length > 0 && !isStreaming;
  const renderableMessages = useMemo(
    () => buildRenderableMessages(messages),
    [messages],
  );

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const message = prompt.trim();

    if (!message || isStreaming) {
      return;
    }

    setPrompt("");
    onSendMessage(message);
  };

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-t border-(--border) bg-(--panel) lg:border-l lg:border-t-0">
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
          renderableMessages.map(({ isStickyPlan, message }, index) => (
            <RenderMessage
              key={`${message.role}-${message.createdAt}-${index}`}
              isStickyPlan={isStickyPlan}
              message={message}
            />
          ))
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
            disabled={isStreaming}
            id="prompt"
            onChange={(event) => setPrompt(event.target.value)}
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
              {isStreaming ? "Sending" : "Send"}
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function IdentityPanel({
  identity,
  onIdentityChange,
}: {
  identity: UserIdentity;
  onIdentityChange: (identity: UserIdentity) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const displayName = identity.isAnonymous
    ? "Anonymous User"
    : (identity.username ?? "User");

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--border) px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-(--control) text-base">
            🙂
          </span>
          <span className="truncate text-sm font-medium">{displayName}</span>
        </div>
        {identity.isAnonymous ? (
          <button
            className="h-8 shrink-0 rounded-md border border-(--border) bg-(--control) px-3 text-xs font-semibold text-(--text) transition hover:bg-(--control-active)"
            onClick={() => setIsDialogOpen(true)}
            type="button"
          >
            Claim Account
          </button>
        ) : null}
      </div>

      {isDialogOpen ? (
        <UsernameDialog
          onComplete={(nextIdentity) => {
            onIdentityChange(nextIdentity);
            setIsDialogOpen(false);
          }}
          onClose={() => setIsDialogOpen(false)}
        />
      ) : null}
    </>
  );
}

function UsernameDialog({
  onComplete,
  onClose,
}: {
  onComplete: (identity: UserIdentity) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"claim" | "signin">("claim");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = username.trim().length >= 3 && !isSubmitting;
  const isClaimMode = mode === "claim";

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const identity = isClaimMode
        ? await claimAccount(username)
        : await signInWithUsername(username);
      onComplete(identity);
    } catch (claimError) {
      setError(
        claimError instanceof Error
          ? claimError
          : new Error("Failed to claim account"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
      <form
        className="w-full max-w-sm rounded-lg border border-(--border) bg-(--panel) p-4 shadow-xl"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Account</h2>
          <button
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-(--muted) transition hover:bg-(--control) hover:text-(--text)"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="mt-4 grid h-9 grid-cols-2 rounded-lg border border-(--border) bg-(--control) p-1 text-sm">
          {(["claim", "signin"] as const).map((tab) => (
            <button
              className={`rounded-md font-medium transition ${
                mode === tab
                  ? "bg-(--control-active) text-(--text) shadow-sm"
                  : "text-(--muted) hover:text-(--text)"
              }`}
              disabled={isSubmitting}
              key={tab}
              onClick={() => {
                setMode(tab);
                setError(null);
              }}
              type="button"
            >
              {tab === "claim" ? "Sign Up" : "Sign In"}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="username">
          Username
        </label>
        <input
          autoFocus
          className="mt-4 h-10 w-full rounded-md border border-(--border) bg-(--control) px-3 text-sm text-(--text) outline-none placeholder:text-(--muted) focus:border-(--accent)"
          disabled={isSubmitting}
          id="username"
          maxLength={32}
          onChange={(event) => {
            setUsername(event.target.value);
            setError(null);
          }}
          placeholder="tanuj"
          value={username}
        />

        {error ? (
          <p className="mt-2 text-xs leading-5 text-red-500">{error.message}</p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            className="h-9 rounded-md bg-(--accent) px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting
              ? isClaimMode
                ? "Continuing"
                : "Signing in"
              : isClaimMode
                ? "Continue"
                : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}

type RenderableMessage = {
  isStickyPlan: boolean;
  message: Message;
};

function buildRenderableMessages(messages: Message[]): RenderableMessage[] {
  const renderableMessages: RenderableMessage[] = [];
  let currentPlanIndex: number | null = null;

  messages.forEach((message) => {
    if (message.role === "user") {
      currentPlanIndex = null;
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    if (message.type !== "plan") {
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    if (currentPlanIndex === null) {
      currentPlanIndex = renderableMessages.length;
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    const currentPlan = renderableMessages[currentPlanIndex]?.message;

    if (currentPlan && isPlanComplete(currentPlan.content)) {
      currentPlanIndex = renderableMessages.length;
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    renderableMessages[currentPlanIndex] = {
      isStickyPlan: false,
      message: {
        ...message,
        createdAt: currentPlan?.createdAt ?? message.createdAt,
      },
    };
  });

  const latestIncompletePlanIndex = renderableMessages.findLastIndex(
    ({ message }) =>
      message.type === "plan" && !isPlanComplete(message.content),
  );

  if (latestIncompletePlanIndex >= 0) {
    renderableMessages[latestIncompletePlanIndex] = {
      ...renderableMessages[latestIncompletePlanIndex]!,
      isStickyPlan: true,
    };
  }

  return renderableMessages;
}

function EmptyState({ detail, title }: { detail?: string; title: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-sm font-medium text-(--text)">{title}</p>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-(--muted)">{detail}</p>
      ) : null}
    </div>
  );
}

function RenderMessage({
  isStickyPlan = false,
  message,
}: {
  isStickyPlan?: boolean;
  message: Message;
}) {
  if (message.type === "qna") {
    return <QnAMessage content={message.content} />;
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

export default App;
