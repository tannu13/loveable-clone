import { metrics, type Attributes } from "@opentelemetry/api";

let httpRequestCounter:
  | ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]>
  | undefined;

export function initializeMetrics() {
  const meter = metrics.getMeter("backend");

  httpRequestCounter = meter.createCounter("http.server.requests.total", {
    description: "Total HTTP requests",
  });
}

export function incrementRequestCounter(attributes: Attributes) {
  httpRequestCounter?.add(1, attributes);
}
