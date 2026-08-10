import { access } from "node:fs/promises";
import env from "../env";
import { getMainRepoPath as getMainRepoPathShared } from "@repo/shared";

export async function checkFileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getMainRepoPath() {
  return getMainRepoPathShared(env.WORKSPACE_DIR);
}

export const getCurrentFormattedDate = () => {
  const now = new Date();

  const year = now.getFullYear();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");

  return `${year}-${day}-${month}-${hours}`;
};
