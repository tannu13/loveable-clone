import { trace } from "@opentelemetry/api";
import { initializeTelemetry, shutdownTelemetry } from "./telemetry";

await initializeTelemetry();

const tracer = trace.getTracer("learning-demo");

const span = tracer.startSpan("main-work");

await new Promise((res) => setTimeout(res, 1000));

span.setAttribute("user.id", "1234");

span.addEvent("Fetching from DB");

await new Promise((res) => setTimeout(res, 500));

span.addEvent("DB returned");

span.end();

await shutdownTelemetry();
