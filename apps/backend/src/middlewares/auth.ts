import type { NextFunction, Request, Response } from "express";
import { verifySessionToken } from "../utils/session-token";
import { UnauthorizedError } from "../utils/custom-errors";

const bearerPrefix = "Bearer ";

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authorization = req.header("authorization");

  if (!authorization?.startsWith(bearerPrefix)) {
    return next(new UnauthorizedError("Missing authorization token"));
  }

  const token = authorization.slice(bearerPrefix.length).trim();

  if (!token) {
    return next(new UnauthorizedError("Missing authorization token"));
  }

  try {
    const payload = verifySessionToken(token);
    req.user = {
      id: payload.sub,
    };

    return next();
  } catch {
    return next(new UnauthorizedError("Invalid authorization token"));
  }
};
