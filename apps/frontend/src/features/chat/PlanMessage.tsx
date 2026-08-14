import { useState } from "react";

export type PlanStepStatus = "pending" | "in_progress" | "completed";

export type PlanStep = {
  status: PlanStepStatus;
  step: string;
};

export type PlanContent = {
  explanation?: string;
  plan: PlanStep[];
};

const STATUS_LABELS: Record<PlanStepStatus, string> = {
  completed: "Done",
  in_progress: "In progress",
  pending: "Pending",
};

function isPlanStepStatus(status: unknown): status is PlanStepStatus {
  return (
    status === "pending" ||
    status === "in_progress" ||
    status === "completed"
  );
}

export function parsePlanContent(content: unknown): PlanContent | null {
  if (typeof content !== "object" || content === null) {
    return null;
  }

  const candidate = content as {
    explanation?: unknown;
    plan?: unknown;
  };

  if (
    candidate.explanation !== undefined &&
    typeof candidate.explanation !== "string"
  ) {
    return null;
  }

  if (!Array.isArray(candidate.plan)) {
    return null;
  }

  const plan = candidate.plan.filter((item): item is PlanStep => {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const candidateItem = item as {
      status?: unknown;
      step?: unknown;
    };

    return (
      typeof candidateItem.step === "string" &&
      candidateItem.step.length > 0 &&
      isPlanStepStatus(candidateItem.status)
    );
  });

  if (plan.length !== candidate.plan.length || plan.length === 0) {
    return null;
  }

  return {
    explanation: candidate.explanation,
    plan,
  };
}

export function isPlanComplete(content: unknown): boolean {
  const parsedContent = parsePlanContent(content);

  return (
    parsedContent !== null &&
    parsedContent.plan.every((item) => item.status === "completed")
  );
}

function getPlanSummary(content: PlanContent): string {
  const completedCount = content.plan.filter(
    (item) => item.status === "completed",
  ).length;
  const activeSteps = content.plan
    .filter((item) => item.status === "in_progress")
    .map((item) => item.step);

  const progressText = `${completedCount} of ${content.plan.length} steps completed.`;

  if (activeSteps.length === 0) {
    return progressText;
  }

  return `${progressText} ${activeSteps.join(" and ")} in progress.`;
}

function getStatusClasses(status: PlanStepStatus): string {
  if (status === "completed") {
    return "border-(--success) bg-(--success-soft) text-(--success)";
  }

  if (status === "in_progress") {
    return "border-(--accent) bg-(--selected) text-(--accent)";
  }

  return "border-(--border) bg-(--control) text-(--muted)";
}

function getDotClasses(status: PlanStepStatus): string {
  if (status === "completed") {
    return "bg-(--success)";
  }

  if (status === "in_progress") {
    return "bg-(--accent)";
  }

  return "bg-(--line-number)";
}

export function PlanMessage({
  content,
  isSticky = false,
}: {
  content: unknown;
  isSticky?: boolean;
}) {
  const parsedContent = parsePlanContent(content);
  const [isCollapsed, setIsCollapsed] = useState(isSticky);

  if (!parsedContent) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Invalid plan format
        </div>
      </div>
    );
  }

  const completedCount = parsedContent.plan.filter(
    (item) => item.status === "completed",
  ).length;
  const progress = Math.round((completedCount / parsedContent.plan.length) * 100);
  const summary = getPlanSummary(parsedContent);

  return (
    <div className="flex justify-start">
      <div
        className={`w-full max-w-[92%] rounded-lg border border-(--border) bg-(--chat-bubble) text-sm text-(--text) shadow-sm ${
          isSticky ? "shadow-lg ring-1 ring-(--accent)" : ""
        }`}
      >
        <button
          aria-expanded={!isCollapsed}
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setIsCollapsed((current) => !current)}
          type="button"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
                Task plan
              </span>
              {isSticky ? (
                <span className="rounded-full bg-(--selected) px-2 py-0.5 text-xs font-medium text-(--accent)">
                  Live
                </span>
              ) : null}
            </span>
            {parsedContent.explanation ? (
              <span className="mt-1 block text-sm font-medium leading-5">
                {parsedContent.explanation}
              </span>
            ) : null}
            <span className="mt-1 block text-xs leading-5 text-(--muted)">
              {summary}
            </span>
          </span>
          <span className="shrink-0 rounded-md border border-(--border) px-2 py-1 text-xs font-medium text-(--muted)">
            {isCollapsed ? "Expand" : "Collapse"}
          </span>
        </button>

        <div className="h-1 bg-(--control)">
          <div
            className="h-full bg-(--accent) transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {!isCollapsed ? (
          <div className="space-y-2 px-3 py-3">
            {parsedContent.plan.map((item, index) => (
              <div
                className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md border border-(--border) bg-(--panel) px-3 py-2.5"
                key={`${item.step}-${index}`}
              >
                <span
                  className={`mt-1.5 size-2.5 rounded-full ${getDotClasses(
                    item.status,
                  )}`}
                />
                <span className="min-w-0 text-sm leading-5">{item.step}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClasses(
                    item.status,
                  )}`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
