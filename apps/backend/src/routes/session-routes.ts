import { Router } from "express";
import { createAnonymousUser } from "../models/session-model";
import { generateSessionToken } from "../utils/session-token";

export const createSessionRoutes = () => {
  const sessionRouter = Router();

  sessionRouter.post("/api/session", async (_req, res) => {
    const user = await createAnonymousUser();
    const token = generateSessionToken(user.id);

    return res.status(201).json({ token });
  });

  return { sessionRouter };
};
