import { type SubmitEventHandler, useState } from "react";
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
