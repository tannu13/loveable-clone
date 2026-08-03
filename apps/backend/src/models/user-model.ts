import db, { eq } from "@repo/db";
import { users } from "@repo/db/schema";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../utils/custom-errors";

const isUniqueViolation = (err: unknown) => {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "23505"
  );
};

export const claimUser = async ({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) => {
  try {
    const existingUser = await db.query.users.findFirst({
      where: ({ username: userUsername }) => eq(userUsername, username),
      columns: {
        id: true,
      },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError("Username already exists", "USERNAME_EXISTS");
    }

    const [user] = await db
      .update(users)
      .set({
        username,
        isAnonymous: false,
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        isAnonymous: users.isAnonymous,
      });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  } catch (err) {
    if (err instanceof ConflictError || err instanceof NotFoundError) {
      throw err;
    }

    if (isUniqueViolation(err)) {
      throw new ConflictError("Username already exists", "USERNAME_EXISTS");
    }

    throw new InternalServerError("Unable to claim user");
  }
};

export const findClaimedUserByUsername = async (username: string) => {
  try {
    const user = await db.query.users.findFirst({
      where: ({ username: userUsername }) => eq(userUsername, username),
      columns: {
        id: true,
        username: true,
        isAnonymous: true,
      },
    });

    if (!user || user.isAnonymous) {
      throw new NotFoundError("User not found");
    }

    return user;
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw err;
    }

    throw new InternalServerError("Unable to find user");
  }
};
