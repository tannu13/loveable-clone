import { incrementRequestCounter } from "@repo/observability";
import type { NextFunction, Request, Response } from "express";

export const addHttpMetrics = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.on("finish", () => {
    incrementRequestCounter({
      method: req.method,
      route: req.route?.path ?? "unknown",
      status_code: res.statusCode,
    });
  });
  next();
};
