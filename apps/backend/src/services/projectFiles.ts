import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectFile } from "../types/projectTypes";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const projectRoot = path.resolve(currentDirectory, "../../../project");

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

export async function readProjectFile(filePath: string): Promise<string> {
  return await readFile(`${projectRoot}/${filePath}`, "utf8");
}

export async function writeProjectFile(filePath: string, content: string) {
  if (!content) return;
  await writeFile(`${projectRoot}/${filePath}`, content, "utf8");
}
