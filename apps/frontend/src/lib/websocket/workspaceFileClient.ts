import type {
  FileContentFramePayload,
  FileListFramePayload,
  ProjectFile,
  WorkspaceErrorFramePayload,
} from "@repo/shared";
import { apiFetch } from "../api";
import { conversationSocketClient } from "./conversationSocketClient";

const REQUEST_TIMEOUT_MS = 20_000;

type PendingEntry<T> = {
  resolve: (payload: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

// No correlation id: a file path (or "the file list") is already a natural,
// idempotent key on its own, unlike QnA's arbitrary non-idempotent
// question/answer pairs. Pending entries are registered synchronously,
// before the triggering HTTP request is even sent, so a response that
// arrives on the already-open websocket ahead of that request's own HTTP
// round trip can never go unheard.
const pendingFileListRequests: PendingEntry<FileListFramePayload>[] = [];
const pendingFileContentRequests = new Map<
  string,
  PendingEntry<FileContentFramePayload>[]
>();

function removeFileListEntry(entry: PendingEntry<FileListFramePayload>) {
  const index = pendingFileListRequests.indexOf(entry);
  if (index !== -1) {
    pendingFileListRequests.splice(index, 1);
  }
}

function removeFileContentEntry(
  path: string,
  entry: PendingEntry<FileContentFramePayload>,
) {
  const entries = pendingFileContentRequests.get(path);
  if (!entries) {
    return;
  }

  const index = entries.indexOf(entry);
  if (index !== -1) {
    entries.splice(index, 1);
  }
  if (entries.length === 0) {
    pendingFileContentRequests.delete(path);
  }
}

function registerFileListRequest(): {
  promise: Promise<FileListFramePayload>;
  entry: PendingEntry<FileListFramePayload>;
} {
  const entry = {} as PendingEntry<FileListFramePayload>;
  const promise = new Promise<FileListFramePayload>((resolve, reject) => {
    entry.resolve = resolve;
    entry.reject = reject;
    entry.timeout = setTimeout(() => {
      removeFileListEntry(entry);
      reject(new Error("Timed out waiting for the file list"));
    }, REQUEST_TIMEOUT_MS);
  });

  pendingFileListRequests.push(entry);

  return { promise, entry };
}

function registerFileContentRequest(path: string): {
  promise: Promise<FileContentFramePayload>;
  entry: PendingEntry<FileContentFramePayload>;
} {
  const entry = {} as PendingEntry<FileContentFramePayload>;
  const promise = new Promise<FileContentFramePayload>((resolve, reject) => {
    entry.resolve = resolve;
    entry.reject = reject;
    entry.timeout = setTimeout(() => {
      removeFileContentEntry(path, entry);
      reject(new Error("Timed out waiting for file content"));
    }, REQUEST_TIMEOUT_MS);
  });

  const entries = pendingFileContentRequests.get(path) ?? [];
  entries.push(entry);
  pendingFileContentRequests.set(path, entries);

  return { promise, entry };
}

conversationSocketClient.subscribe({
  onMessage: (frame) => {
    if (frame.type === "file_list") {
      const payload = frame.payload as FileListFramePayload;
      const entries = pendingFileListRequests.splice(
        0,
        pendingFileListRequests.length,
      );
      entries.forEach((entry) => {
        clearTimeout(entry.timeout);
        entry.resolve(payload);
      });
      return;
    }

    if (frame.type === "file_content") {
      const payload = frame.payload as FileContentFramePayload;
      const entries = pendingFileContentRequests.get(payload.path);
      if (!entries) {
        return;
      }
      pendingFileContentRequests.delete(payload.path);
      entries.forEach((entry) => {
        clearTimeout(entry.timeout);
        entry.resolve(payload);
      });
      return;
    }

    if (frame.type === "workspace_error") {
      const payload = frame.payload as WorkspaceErrorFramePayload;
      const error = new Error(payload.message);

      if (payload.path) {
        const entries = pendingFileContentRequests.get(payload.path);
        if (entries) {
          pendingFileContentRequests.delete(payload.path);
          entries.forEach((entry) => {
            clearTimeout(entry.timeout);
            entry.reject(error);
          });
        }
        return;
      }

      const entries = pendingFileListRequests.splice(
        0,
        pendingFileListRequests.length,
      );
      entries.forEach((entry) => {
        clearTimeout(entry.timeout);
        entry.reject(error);
      });
    }
  },
});

export async function requestFileList(
  conversationId: string,
): Promise<ProjectFile[]> {
  const { promise, entry } = registerFileListRequest();

  const response = await apiFetch(
    `/api/conversation/${encodeURIComponent(conversationId)}/files`,
  );

  if (!response.ok) {
    removeFileListEntry(entry);
    clearTimeout(entry.timeout);
    throw new Error(`Failed to request file list: ${response.status}`);
  }

  const result = await promise;
  return result.files;
}

export async function requestFileContent(
  conversationId: string,
  path: string,
): Promise<string> {
  const { promise, entry } = registerFileContentRequest(path);

  const response = await apiFetch(
    `/api/conversation/${encodeURIComponent(conversationId)}/files/content?path=${encodeURIComponent(path)}`,
  );

  if (!response.ok) {
    removeFileContentEntry(path, entry);
    clearTimeout(entry.timeout);
    throw new Error(`Failed to request file content: ${response.status}`);
  }

  const result = await promise;
  return result.content;
}
