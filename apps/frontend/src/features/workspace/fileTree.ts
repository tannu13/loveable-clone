import type { ProjectFile } from "@repo/shared";

export type FileTreeRow =
  | {
      depth: number;
      kind: "folder";
      path: string;
      name: string;
    }
  | {
      depth: number;
      kind: "file";
      path: string;
      name: string;
      file: ProjectFile;
    };

export function buildFileTreeRows(files: ProjectFile[]): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  const seenFolders = new Set<string>();

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);

    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join("/");
      const isFile = index === segments.length - 1;

      if (isFile) {
        rows.push({
          depth: index,
          kind: "file",
          path,
          name: segment,
          file,
        });
        return;
      }

      if (!seenFolders.has(path)) {
        seenFolders.add(path);
        rows.push({
          depth: index,
          kind: "folder",
          path,
          name: segment,
        });
      }
    });
  }

  return rows;
}
