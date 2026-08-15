import { useState } from "react";
import { EmptyState } from "../../components/EmptyState";

const COPY_FEEDBACK_MS = 1500;

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

export function PreviewWorkspace({
  isLoading,
  previewUrl,
  reloadKey,
}: {
  isLoading: boolean;
  previewUrl: string;
  reloadKey: number;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!previewUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(previewUrl);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard access can fail (e.g. insecure context or denied
      // permission) — the URL is still visible/selectable in the pill, so
      // there's nothing further to do here.
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-(--border) bg-(--panel)">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-(--border) px-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-red-400" />
          <span className="size-3 rounded-full bg-yellow-400" />
          <span className="size-3 rounded-full bg-green-400" />
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate rounded-full bg-(--control) px-3 py-1 text-xs text-(--muted)">
            {previewUrl || "No preview URL"}
          </span>
          {previewUrl ? (
            <>
              <button
                aria-label={isCopied ? "Copied" : "Copy preview URL"}
                className="grid size-6 shrink-0 place-items-center rounded-md text-(--muted) transition hover:bg-(--control) hover:text-(--text)"
                onClick={handleCopy}
                title={isCopied ? "Copied!" : "Copy URL"}
                type="button"
              >
                {isCopied ? <CheckIcon /> : <CopyIcon />}
              </button>
              <a
                aria-label="Open preview in a new tab"
                className="grid size-6 shrink-0 place-items-center rounded-md text-(--muted) transition hover:bg-(--control) hover:text-(--text)"
                href={previewUrl}
                rel="noopener noreferrer"
                target="_blank"
                title="Open in new tab"
              >
                <ExternalLinkIcon />
              </a>
            </>
          ) : null}
        </div>

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
