import { useState } from "react";
import { deleteConversation } from "../../api/conversations";

export function DeleteConversationDialog({
  conversationId,
  onClose,
  onDeleted,
  title,
}: {
  conversationId: string;
  onClose: () => void;
  onDeleted: () => void;
  title: string;
}) {
  const [error, setError] = useState<Error | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await deleteConversation(conversationId);
      onDeleted();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError
          : new Error("Failed to delete conversation"),
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
      <div className="w-full max-w-sm rounded-lg border border-(--border) bg-(--panel) p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Delete conversation</h2>
          <button
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-(--muted) transition hover:bg-(--control) hover:text-(--text)"
            disabled={isDeleting}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-(--muted)">
          Delete <span className="font-medium text-(--text)">"{title}"</span>?
          This can't be undone.
        </p>

        {error ? (
          <p className="mt-2 text-xs leading-5 text-red-500">{error.message}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="h-9 rounded-md border border-(--border) px-4 text-sm font-medium text-(--text) transition hover:bg-(--control) disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isDeleting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-9 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isDeleting}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? "Deleting" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
