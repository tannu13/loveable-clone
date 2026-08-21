import type { Logger } from "./types";

/** Used when a consumer does not bring its own logger. */
export const consoleLogger: Logger = {
  info: (message, ...meta) => console.log(message, ...meta),
  error: (message, ...meta) => console.error(message, ...meta),
};
