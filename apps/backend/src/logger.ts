import { createRequire } from "module";
import env from "./env";

const require = createRequire(import.meta.url);
const pino = require("pino");
export const logger = pino({
  level: env.LOG_LEVEL || "info",
});
