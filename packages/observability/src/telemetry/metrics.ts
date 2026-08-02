import { metrics, type Attributes } from "@opentelemetry/api";

let httpRequestCounter:
  | ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>
  | undefined;

let httpRequestDuration:
  | ReturnType<ReturnType<typeof metrics.getMeter>["createHistogram"]>
  | undefined;

export function initializeMetrics(serviceName: string) {
  const meter = metrics.getMeter(serviceName);

  httpRequestCounter = meter.createCounter("http.server.requests.total", {
    description: "Total HTTP requests",
  });

  httpRequestDuration = meter.createHistogram("http.server.request.duration", {
    description: "HTTP request duration",
    unit: "ms",
  });
}

export function incrementRequestCounter(attributes: Attributes) {
  httpRequestCounter?.add(1, attributes);
}

export function recordRequestDuration(
  duration: number,
  attributes: Attributes,
) {
  httpRequestDuration?.record(duration, attributes);
}
