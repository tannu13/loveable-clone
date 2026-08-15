import { type SubmitEventHandler, useState } from "react";
import { renameConversation } from "../../api/conversations";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

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
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
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
            <p className="mt-2 text-xs leading-5 text-red-500">
              {error.message}
            </p>
          ) : null}

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
