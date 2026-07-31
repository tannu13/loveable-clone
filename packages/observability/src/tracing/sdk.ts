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

export function initializeTracing(config: {
  serviceName: string;
  serviceVer: string;
  env: "development" | "staging" | "production";
  exporterUrl: string;
}) {
  const exporter = new OTLPTraceExporter({
    url: config.exporterUrl,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVer,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.env,
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
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
    ],
  });

  sdk.start();

  return sdk;
}
