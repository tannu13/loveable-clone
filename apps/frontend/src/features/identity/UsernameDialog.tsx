import { type SubmitEventHandler, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  claimAccount,
  signInWithUsername,
  type UserIdentity,
} from "../../lib/identity";

export function UsernameDialog({
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
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
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
            <p className="mt-2 text-xs leading-5 text-red-500">
              {error.message}
            </p>
          ) : null}

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
