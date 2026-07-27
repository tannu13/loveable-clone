import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

const exporter = new OTLPTraceExporter({
  url: "http://localhost:4318/v1/traces",
});

const sdk = new NodeSDK({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy fine-grained internal tracing
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-dns": { enabled: false },
      "@opentelemetry/instrumentation-net": { enabled: false },
      "@opentelemetry/instrumentation-http": { enabled: false },
    }),
  ],
});

export async function initializeTelemetry() {
  await sdk.start();
}

export async function shutdownTelemetry() {
  await sdk.shutdown();
}
