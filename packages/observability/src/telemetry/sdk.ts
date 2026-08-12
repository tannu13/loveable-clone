import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { ExpressLayerType } from "@opentelemetry/instrumentation-express";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { initializeMetrics } from "./metrics";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";

export function initializeObservability(config: {
  serviceName: string;
  serviceVer: string;
  env: "development" | "staging" | "production";
  exporterUrl: string;
}) {
  const traceExporter = new OTLPTraceExporter({
    url: `${config.exporterUrl}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${config.exporterUrl}/v1/metrics`,
  });

  const logExporter = new OTLPLogExporter({
    url: `${config.exporterUrl}/v1/logs`,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVer,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.env,
    }),
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 15000, // Export interval every 15 secs
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: logExporter,
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        "@opentelemetry/instrumentation-dns": {
          enabled: false,
        },
        "@opentelemetry/instrumentation-net": {
          enabled: false,
        },

        "@opentelemetry/instrumentation-express": {
          ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
        },
      }),
      new PinoInstrumentation(),
    ],
  });

  sdk.start();

  initializeMetrics(config.serviceName);

  return sdk;
}
