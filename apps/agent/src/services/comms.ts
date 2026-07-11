const comms: Map<string, (value: Record<string, unknown>) => void> = new Map();

export function waitForResponse(correlationId: string) {
  const res = new Promise<Record<string, unknown>>((resolver) => {
    comms.set(correlationId, resolver);
  });

  return res;
}

export function resolveResponse(
  correlationId: string,
  payload: Record<string, unknown>,
) {
  const pr = comms.get(correlationId);
  if (!pr) return;

  pr(payload);
}
