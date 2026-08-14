import { EmptyState } from "../../components/EmptyState";

export function PreviewWorkspace({
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
