import "dotenv/config";
import { initializeTracing } from "@repo/observability";
async function bootstrap() {
  const env = (await import("./env")).default;

  initializeTracing({
    serviceName: "backend",
    serviceVer: "0.0.1",
    env: env.NODE_ENV,
    exporterUrl: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

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
