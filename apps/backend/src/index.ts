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

  console.log(
    "env.OTEL_EXPORTER_OTLP_ENDPOINT",
    env.OTEL_EXPORTER_OTLP_ENDPOINT,
  );

  const { default: app } = await import("./server");

  app
    .listen(env.APP_PORT, () => {
      console.log(`Server running on ${env.APP_PORT}`);
    })
    .on("error", (err) => {
      console.error("Listen failed:", err);
    });
}

bootstrap().catch((err) => {
  console.error("Failed to start application:", err);
});
