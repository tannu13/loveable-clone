export { initializeObservability } from "./telemetry/sdk";
export { getTracer, setSpanAttributes } from "./telemetry/tracer";
export { withActiveSpan } from "./telemetry/spans";
export {
  incrementRequestCounter,
  recordRequestDuration,
} from "./telemetry/metrics";
