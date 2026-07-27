import "dotenv/config";
import { initializeTelemetry } from "./observability/telemetry";
async function bootstrap() {
  await initializeTelemetry();

  const env = (await import("./env")).default;
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
