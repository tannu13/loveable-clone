import { useState } from "react";
import { deleteConversation } from "../../api/conversations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

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
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete conversation</DialogTitle>
        </DialogHeader>

        <DialogDescription>
          Delete <span className="font-medium text-(--text)">"{title}"</span>?
          This can't be undone.
        </DialogDescription>

        {error ? (
          <p className="mt-2 text-xs leading-5 text-red-500">
            {error.message}
          </p>
        ) : null}

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
