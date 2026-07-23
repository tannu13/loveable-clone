const comms: Map<string, (value: unknown) => void> = new Map();

export function waitForResponse(correlationId: string) {
  const res = new Promise<unknown>((resolver) => {
    comms.set(correlationId, resolver);
  });

  return res;
}

export function resolveResponse(correlationId: string, payload: unknown) {
  const pr = comms.get(correlationId);
  if (!pr) return;

  pr(payload);
}
