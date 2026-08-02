import {
  incrementRequestCounter,
  recordRequestDuration,
} from "@repo/observability";
import type { NextFunction, Request, Response } from "express";

export const addHttpMetrics = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = performance.now();

  res.on("finish", () => {
    const duration = performance.now() - start;

    incrementRequestCounter({
      method: req.method,
      route: req.route?.path ?? "unknown",
      status_code: res.statusCode,
    });

    recordRequestDuration(duration, {
      method: req.method,
      route: req.route?.path ?? "unknown",
      status_code: res.statusCode,
    });
  });
  next();
};
