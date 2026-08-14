import { useState } from "react";
import { bootstrapSession } from "../lib/session";

export function LandingPage({ onStart }: { onStart: () => void }) {
  const [error, setError] = useState<Error | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (isStarting) {
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      await bootstrapSession();
      onStart();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError
          : new Error("Failed to start session"),
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-(--app-bg) px-4 text-(--text)">
      <section className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">
          Build apps with AI
        </h1>
        <button
          className="mt-8 h-11 rounded-lg bg-(--accent) px-5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isStarting}
          onClick={handleStart}
          type="button"
        >
          {isStarting ? "Starting" : "Start Building"}
        </button>
        {error ? (
          <p className="mt-4 text-sm leading-6 text-red-500">{error.message}</p>
        ) : null}
      </section>
    </main>
  );
}
