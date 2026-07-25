import type { ProjectFile } from "@repo/shared";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import env from "../../env";

const projectRoot = path.resolve(env.WORKSPACE_DIR);

const editableExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".ts",
  ".tsx",
]);
const ignoredDirectories = new Set(["node_modules", "dist", ".vite"]);

export async function listProjectFiles(): Promise<ProjectFile[]> {
  const paths = await walkProject(projectRoot);
  const files = await Promise.all(
    paths.map(async (filePath) => ({
      path: toProjectPath(filePath),
      content: await readFile(filePath, "utf8"),
    })),
  );

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function walkProject(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await walkProject(fullPath)));
      }
      continue;
    }

    if (entry.isFile() && editableExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function toProjectPath(filePath: string) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function resolveProjectPath(filePath: string) {
  const resolvedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(projectRoot, filePath);
  const relativePath = path.relative(projectRoot, resolvedPath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path is outside the project workspace: ${filePath}`);
  }

  return resolvedPath;
}

export async function readProjectFile(filePath: string): Promise<string> {
  return await readFile(resolveProjectPath(filePath), "utf8");
}

export async function writeProjectFile(filePath: string, content: string) {
  if (!content) return;
  const resolvedPath = resolveProjectPath(filePath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, content, "utf8");
}
