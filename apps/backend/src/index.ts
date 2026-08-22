import "dotenv/config";
import { initializeObservability } from "@repo/observability";
async function bootstrap() {
  const env = (await import("./env")).default;

  initializeObservability({
    serviceName: "backend",
    serviceVer: "0.0.1",
    env: env.NODE_ENV,
    exporterUrl: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const { default: app } = await import("./server");
  const { logger } = await import("./logger");

  app
    .listen(env.APP_PORT, () => {
      logger.info(`Server running on ${env.APP_PORT}`);
    })
    .on("error", (err) => {
      logger.error(`Listen failed: ${err.message}`);
    });
}

bootstrap().catch((err: unknown) => {
  console.error("Failed to start application:", err);
});
