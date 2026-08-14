export function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="animate-pulse rounded-lg border border-(--border) bg-(--chat-bubble) px-4 py-3 text-sm text-(--muted)">
        Thinking...
      </div>
    </div>
  );
}
