import db from "@repo/db";
import { users } from "@repo/db/schema";
import { InternalServerError } from "../utils/custom-errors";

export const createAnonymousUser = async () => {
  try {
    const [user] = await db
      .insert(users)
      .values({
        isAnonymous: true,
      })
      .returning({
        id: users.id,
      });

    if (!user) {
      throw new InternalServerError("Unable to create anonymous user");
    }

    return user;
  } catch {
    throw new InternalServerError("Unable to create anonymous user");
  }
};
