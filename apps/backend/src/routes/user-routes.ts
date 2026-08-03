import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { claimUser, findClaimedUserByUsername } from "../models/user-model";
import {
  ClaimUserSchema,
  LoginSchema,
  type TClaimUserSchema,
  type TLoginSchema,
} from "../types/validations";
import { generateSessionToken } from "../utils/session-token";
import { UnauthorizedError } from "../utils/custom-errors";

export const createUserRoutes = () => {
  const userRouter = Router();

  userRouter.post(
    "/users/claim",
    authMiddleware,
    validate("body", ClaimUserSchema),
    async (req, res) => {
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError();
      }

      const { username } = req.body as TClaimUserSchema;
      const user = await claimUser({ userId, username });

      return res.status(200).json({ user });
    },
  );

  userRouter.post("/login", validate("body", LoginSchema), async (req, res) => {
    const { username } = req.body as TLoginSchema;
    const user = await findClaimedUserByUsername(username);
    const token = generateSessionToken(user.id);

    return res.status(200).json({ token, user });
  });

  return { userRouter };
};
