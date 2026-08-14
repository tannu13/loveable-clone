import type { Message } from "@repo/shared";
import { isPlanComplete } from "./PlanMessage";

export type RenderableMessage = {
  isStickyPlan: boolean;
  message: Message;
};

export function buildRenderableMessages(messages: Message[]): RenderableMessage[] {
  const renderableMessages: RenderableMessage[] = [];
  let currentPlanIndex: number | null = null;

  messages.forEach((message) => {
    if (message.role === "user") {
      currentPlanIndex = null;
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    if (message.type !== "plan") {
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    if (currentPlanIndex === null) {
      currentPlanIndex = renderableMessages.length;
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    const currentPlan = renderableMessages[currentPlanIndex]?.message;

    if (currentPlan && isPlanComplete(currentPlan.content)) {
      currentPlanIndex = renderableMessages.length;
      renderableMessages.push({ isStickyPlan: false, message });
      return;
    }

    renderableMessages[currentPlanIndex] = {
      isStickyPlan: false,
      message: {
        ...message,
        createdAt: currentPlan?.createdAt ?? message.createdAt,
      },
    };
  });

  const latestIncompletePlanIndex = renderableMessages.findLastIndex(
    ({ message }) =>
      message.type === "plan" && !isPlanComplete(message.content),
  );

  if (latestIncompletePlanIndex >= 0) {
    renderableMessages[latestIncompletePlanIndex] = {
      ...renderableMessages[latestIncompletePlanIndex]!,
      isStickyPlan: true,
    };
  }

  return renderableMessages;
}
