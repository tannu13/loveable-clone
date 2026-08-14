import { useState } from "react";
import type { UserIdentity } from "../../lib/identity";
import { UsernameDialog } from "./UsernameDialog";

export function IdentityPanel({
  identity,
  onIdentityChange,
}: {
  identity: UserIdentity;
  onIdentityChange: (identity: UserIdentity) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const displayName = identity.isAnonymous
    ? "Anonymous User"
    : (identity.username ?? "User");

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--border) px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-(--control) text-base">
            🙂
          </span>
          <span className="truncate text-sm font-medium">{displayName}</span>
        </div>
        {identity.isAnonymous ? (
          <button
            className="h-8 shrink-0 rounded-md border border-(--border) bg-(--control) px-3 text-xs font-semibold text-(--text) transition hover:bg-(--control-active)"
            onClick={() => setIsDialogOpen(true)}
            type="button"
          >
            Claim Account
          </button>
        ) : null}
      </div>

      {isDialogOpen ? (
        <UsernameDialog
          onComplete={(nextIdentity) => {
            onIdentityChange(nextIdentity);
            setIsDialogOpen(false);
          }}
          onClose={() => setIsDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
