import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);
const exporter = new OTLPTraceExporter({
  url: "http://localhost:4318/v1/traces",
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "backend",
    [ATTR_SERVICE_VERSION]: "0.0.1",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: "development",
  }),
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
