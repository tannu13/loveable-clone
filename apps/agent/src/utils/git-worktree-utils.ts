import { execFile as execFileCb } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", args, { cwd });
    return stdout.trim();
  } catch (err: unknown) {
    const execError = err as { stderr?: string; message?: string };
    const stderr = execError.stderr
      ? execError.stderr.trim()
      : execError.message;

    throw new Error(`Git command failed [git ${args.join(" ")}]: ${stderr}`);
  }
}

function getWorktreePath(mainRepoFolder: string, branchName: string) {
  const absolutePath = path.resolve(mainRepoFolder);
  const parentDir = path.dirname(absolutePath);
  const repoName = path.basename(absolutePath);

  return path.join(parentDir, `${repoName}-wt-${branchName}`);
}

export async function initializeWorktree(
  mainRepoFolder: string,
  branchName: string,
) {
  const worktreePath = getWorktreePath(mainRepoFolder, branchName);
  // validate branch exist
  let branchExists = false;
  try {
    await runGit(
      ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
      mainRepoFolder,
    );
    branchExists = true;
  } catch {
    branchExists = false;
  }

  const args = ["worktree", "add", worktreePath];
  if (!branchExists) {
    args.push("-b");
  }
  args.push(branchName);

  await runGit(args, mainRepoFolder);

  return { worktreePath, branchName };
}

export async function createDiffArtifact(
  worktreePath: string,
  artifactPath: string,
  baseBranch = "master",
) {
  const absoluteWorktreePath = path.resolve(worktreePath);
  const absoluteArtifactPath = path.resolve(artifactPath);

  await runGit(
    ["diff", `${baseBranch}..HEAD`, "--output", absoluteArtifactPath],
    absoluteWorktreePath,
  );

  return absoluteArtifactPath;
}

export async function cleanupWorktree(
  mainRepoFolder: string,
  branchName: string,
) {
  const absolutePath = path.resolve(mainRepoFolder);
  const worktreePath = getWorktreePath(mainRepoFolder, branchName);
  try {
    await runGit(["worktree", "remove", "--force", worktreePath], absolutePath);
    await runGit(["branch", "-D", branchName], absolutePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[WARN] Git worktree removal failed, falling back to FS removal: ${msg}`,
    );
    // await rm(worktreePath, { recursive: true, force: true });
  }

  try {
    // prune worktree
    await runGit(["worktree", "prune"], absolutePath);
  } catch {
    // suppress
  }
}
