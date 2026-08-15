import { type SubmitEventHandler, useState } from "react";
import { renameConversation } from "../../api/conversations";

export function RenameConversationDialog({
  conversationId,
  currentTitle,
  onClose,
  onRenamed,
}: {
  conversationId: string;
  currentTitle: string;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await renameConversation(conversationId, title.trim());
      onRenamed();
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError
          : new Error("Failed to rename conversation"),
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
          <h2 className="text-base font-semibold">Rename conversation</h2>
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

        <label className="sr-only" htmlFor="conversation-title">
          Title
        </label>
        <input
          autoFocus
          className="mt-4 h-10 w-full rounded-md border border-(--border) bg-(--control) px-3 text-sm text-(--text) outline-none placeholder:text-(--muted) focus:border-(--accent)"
          disabled={isSubmitting}
          id="conversation-title"
          maxLength={255}
          onChange={(event) => {
            setTitle(event.target.value);
            setError(null);
          }}
          placeholder="Conversation title"
          value={title}
        />

        {error ? (
          <p className="mt-2 text-xs leading-5 text-red-500">{error.message}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="h-9 rounded-md border border-(--border) px-4 text-sm font-medium text-(--text) transition hover:bg-(--control) disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-9 rounded-md bg-(--accent) px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "Saving" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
