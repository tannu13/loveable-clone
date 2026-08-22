import type { Attributes } from "@opentelemetry/api";
import { getTracer } from "./tracer";

type SpanOptions = {
  attributes?: Attributes;
};

export function withActiveSpan<T>(
  name: string,
  fn: () => Promise<T> | T,
  options?: SpanOptions,
) {
  return getTracer().startActiveSpan(name, async (span) => {
    if (options?.attributes) {
      span.setAttributes(options.attributes);
    }

    try {
      return await fn();
    } catch (err) {
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
