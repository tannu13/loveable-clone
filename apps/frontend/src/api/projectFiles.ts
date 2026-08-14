import { apiFetch } from "../lib/api";

export async function fetchProjectFileContent(path: string): Promise<string> {
  const response = await apiFetch(
    `/api/project/file?path=${encodeURIComponent(path)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to load file content: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return response.text();
  }

  const payload = (await response.json()) as unknown;

  if (typeof payload === "string") {
    return payload;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "content" in payload &&
    typeof payload.content === "string"
  ) {
    return payload.content;
  }

  throw new Error("File content response did not include text content");
}
