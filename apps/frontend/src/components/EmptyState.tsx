export function EmptyState({ detail, title }: { detail?: string; title: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-sm font-medium text-(--text)">{title}</p>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-(--muted)">{detail}</p>
      ) : null}
    </div>
  );
}
