import type { ProjectFile } from "@repo/shared";
import { useMemo } from "react";
import { EmptyState } from "../../components/EmptyState";
import { buildFileTreeRows } from "./fileTree";

export function CodeWorkspace({
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
