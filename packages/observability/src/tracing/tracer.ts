import { trace, type Attributes } from "@opentelemetry/api";

export function getTracer(name = "@repo/telemetry") {
  return trace.getTracer(name);
}

export function setSpanAttributes(attributes: Attributes) {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttributes(attributes);
}
