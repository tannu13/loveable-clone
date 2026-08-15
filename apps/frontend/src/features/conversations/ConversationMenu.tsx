import { useEffect, useRef, useState } from "react";

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

export function ConversationMenu({
  onDelete,
  onRename,
}: {
  onDelete: () => void;
  onRename: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-label="Conversation options"
        className="grid size-6 shrink-0 place-items-center rounded-md text-(--muted) transition hover:bg-(--control) hover:text-(--text)"
        onClick={() => setIsOpen((current) => !current)}
        title="Conversation options"
        type="button"
      >
        <MoreIcon />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-md border border-(--border) bg-(--panel) py-1 shadow-lg">
          <button
            className="block w-full px-3 py-2 text-left text-sm text-(--text) transition hover:bg-(--control)"
            onClick={() => {
              setIsOpen(false);
              onRename();
            }}
            type="button"
          >
            Rename
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-sm text-red-500 transition hover:bg-(--control)"
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
            type="button"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
