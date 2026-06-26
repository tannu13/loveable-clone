import type { Message, ProjectFile, ProjectSnapshot } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type ViewMode = "code" | "preview";

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
  const response = await fetch("/api/project");

  if (!response.ok) {
    throw new Error(`Failed to load project: ${response.status}`);
  }

  return response.json() as Promise<ProjectSnapshot>;
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
  const [viewMode, setViewMode] = useState<ViewMode>("code");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["project"],
    queryFn: fetchProjectSnapshot,
  });

  const files = projectQuery.data?.files ?? [];
  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedFilePath) ?? files[0],
    [files, selectedFilePath],
  );

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFilePath(null);
      return;
    }

    if (!selectedFilePath || !files.some((file) => file.path === selectedFilePath)) {
      setSelectedFilePath(files[0]!.path);
    }
  }, [files, selectedFilePath]);

  const statusLabel = projectQuery.isLoading
    ? "Loading"
    : projectQuery.isError
      ? "Offline"
      : "Synced";

  return (
    <main className="min-h-dvh bg-[var(--app-bg)] text-[var(--text)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
              L
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-5">
                Loveable Workspace
              </h1>
              <p className="hidden text-xs text-[var(--muted)] sm:block">
                app-builder / live project
              </p>
            </div>
          </div>

          <div className="grid h-9 grid-cols-2 rounded-lg border border-[var(--border)] bg-[var(--control)] p-1 text-sm">
            {(["code", "preview"] as const).map((mode) => (
              <button
                className={`h-7 min-w-20 rounded-md px-3 font-medium transition ${
                  viewMode === mode
                    ? "bg-[var(--control-active)] text-[var(--text)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
                key={mode}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode === "code" ? "Code" : "Preview"}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-2 text-xs text-[var(--muted)] md:flex">
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1">
              {statusLabel}
            </span>
            <button
              className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--control)] text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              aria-label="Open settings"
            >
              ...
            </button>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-h-0 overflow-hidden p-3 sm:p-4">
            {viewMode === "code" ? (
              <CodeWorkspace
                error={projectQuery.error}
                files={files}
                isError={projectQuery.isError}
                isLoading={projectQuery.isLoading}
                onSelectFile={setSelectedFilePath}
                selectedFile={selectedFile}
              />
            ) : (
              <PreviewWorkspace
                isLoading={projectQuery.isLoading}
                previewUrl={projectQuery.data?.previewUrl ?? ""}
              />
            )}
          </section>

          <ChatPanel
            isLoading={projectQuery.isLoading}
            messages={projectQuery.data?.messageHistory ?? []}
          />
        </div>
      </div>
    </main>
  );
}

function CodeWorkspace({
  error,
  files,
  isError,
  isLoading,
  onSelectFile,
  selectedFile,
}: {
  error: Error | null;
  files: ProjectFile[];
  isError: boolean;
  isLoading: boolean;
  onSelectFile: (path: string) => void;
  selectedFile?: ProjectFile;
}) {
  const treeRows = useMemo(() => buildFileTreeRows(files), [files]);
  const codeLines = selectedFile?.content.split("\n") ?? [];

  return (
    <div className="grid h-full min-h-[680px] grid-cols-1 gap-3 md:grid-cols-[280px_minmax(0,1fr)] lg:min-h-0">
      <aside className="flex min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <div className="flex h-11 items-center justify-between border-b border-[var(--border)] px-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Files
          </span>
          <span className="text-xs text-[var(--muted)]">{files.length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {isLoading ? (
            <EmptyState title="Loading project files" />
          ) : isError ? (
            <EmptyState title="Could not load project" detail={error?.message} />
          ) : treeRows.length === 0 ? (
            <EmptyState title="No files returned" />
          ) : (
            treeRows.map((row) =>
              row.kind === "folder" ? (
                <div
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-[var(--muted)]"
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
                      ? "bg-[var(--selected)] text-[var(--text)]"
                      : "text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--text)]"
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

      <section className="flex min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--editor)]">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--accent)]" />
            <span className="truncate text-sm font-medium">
              {selectedFile?.path ?? "No file selected"}
            </span>
          </div>
          <span className="text-xs text-[var(--muted)]">
            {selectedFile ? `${codeLines.length} lines` : "Project"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6">
          {isLoading ? (
            <EmptyState title="Loading code" />
          ) : isError ? (
            <EmptyState title="Unable to read project" detail={error?.message} />
          ) : !selectedFile ? (
            <EmptyState title="Select a file to view its code" />
          ) : (
            codeLines.map((line, index) => (
              <div
                className="grid grid-cols-[2.5rem_minmax(max-content,1fr)]"
                key={`${selectedFile.path}-${index}`}
              >
                <span className="select-none pr-4 text-right text-[var(--line-number)]">
                  {index + 1}
                </span>
                <code className="whitespace-pre text-[var(--code)]">{line}</code>
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
}: {
  isLoading: boolean;
  previewUrl: string;
}) {
  return (
    <section className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] lg:min-h-0">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-red-400" />
          <span className="size-3 rounded-full bg-yellow-400" />
          <span className="size-3 rounded-full bg-green-400" />
        </div>
        <span className="truncate rounded-full bg-[var(--control)] px-3 py-1 text-xs text-[var(--muted)]">
          {previewUrl || "No preview URL"}
        </span>
        <span className="hidden text-xs text-[var(--muted)] sm:block">
          Live app
        </span>
      </div>

      <div className="min-h-0 flex-1 bg-[var(--preview-bg)] p-3 sm:p-4">
        {isLoading ? (
          <div className="grid h-full place-items-center rounded-lg border border-[var(--preview-border)] bg-[var(--preview-surface)]">
            <EmptyState title="Loading preview" />
          </div>
        ) : previewUrl ? (
          <iframe
            className="h-full w-full rounded-lg border border-[var(--preview-border)] bg-white"
            src={previewUrl}
            title="Project preview"
          />
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-[var(--preview-border)] bg-[var(--preview-surface)]">
            <EmptyState title="No preview URL returned" />
          </div>
        )}
      </div>
    </section>
  );
}

function ChatPanel({
  isLoading,
  messages,
}: {
  isLoading: boolean;
  messages: Message[];
}) {
  return (
    <aside className="flex min-h-[620px] flex-col border-t border-[var(--border)] bg-[var(--panel)] lg:min-h-0 lg:border-l lg:border-t-0">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div>
          <h2 className="text-sm font-semibold">Assistant</h2>
          <p className="text-xs text-[var(--muted)]">Project conversation</p>
        </div>
        <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--success)]">
          Ready
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-5">
        {isLoading ? (
          <EmptyState title="Loading messages" />
        ) : messages.length === 0 ? (
          <EmptyState title="No conversation yet" detail="Messages from the project API will appear here." />
        ) : (
          messages.map((message, index) => (
            <div
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
              key={`${message.role}-${message.createdAt}-${index}`}
            >
              <div
                className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] bg-[var(--chat-bubble)] text-[var(--text)]"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="border-t border-[var(--border)] p-4">
        <label className="sr-only" htmlFor="prompt">
          Message
        </label>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-2 focus-within:border-[var(--accent)]">
          <textarea
            className="h-24 w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            id="prompt"
            placeholder="Ask the assistant to change the UI..."
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[var(--muted)]">Input is not wired yet</span>
            <button
              className="h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              type="button"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function EmptyState({ detail, title }: { detail?: string; title: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p>
      ) : null}
    </div>
  );
}

export default App;
