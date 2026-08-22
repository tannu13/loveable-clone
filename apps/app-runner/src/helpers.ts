import { spawn } from "bun";
import { logs } from "./services/logBuffer";
import env from "./env";
import { currentOperation } from "./services/currentOperation";

export async function streamOutput(
  output: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
) {
  const reader = output.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      const text = decoder.decode(value, { stream: true });
      if (text) {
        onText(text);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamStdout(stdout: ReadableStream<Uint8Array>) {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      console.log(`[Vite Output]: ${decoder.decode(value, { stream: true })}`);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamStderr(stderr: ReadableStream<Uint8Array>) {
  const reader = stderr.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      console.error(`[Vite Error]: ${decoder.decode(value, { stream: true })}`);
    }
  } finally {
    reader.releaseLock();
  }
}

export function appendLog(
  source: "dev" | "install" | "package",
  stream: "stdout" | "stderr" | "system",
  text: string,
) {
  logs.append(source, stream, text);

  if (stream === "stderr") {
    console.error(`[${source} ${stream}]: ${text}`);
    return;
  }

  console.log(`[${source} ${stream}]: ${text}`);
}

function runCommand(
  source: "install" | "package",
  command: string,
  args: string[],
) {
  return new Promise<{
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    error?: string;
  }>((resolve) => {
    const child = spawn([command, ...args], {
      cwd: env.APP_DIR,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    let stdout = "";
    let stderr = "";

    void streamOutput(child.stdout, (text) => {
      stdout += text;
      appendLog(source, "stdout", text);
    });

    void streamOutput(child.stderr, (text) => {
      stderr += text;
      appendLog(source, "stderr", text);
    });

    child.exited
      .then((exitCode) => {
        resolve({
          success: exitCode === 0,
          exitCode,
          stdout,
          stderr,
        });
      })
      .catch((error: unknown) => {
        resolve({
          success: false,
          exitCode: null,
          stdout,
          stderr,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

export async function runExclusivePackageCommand(
  type: "install" | "package",
  command: string,
  args: string[],
) {
  if (currentOperation.get()) {
    return {
      status: "busy",
      operation: currentOperation.get(),
    };
  }

  currentOperation.set({ type, startedAt: new Date().toISOString() });
  appendLog(type, "system", `Running ${command} ${args.join(" ")}`.trim());

  try {
    const result = await runCommand(type, command, args);
    appendLog(
      type,
      "system",
      `Command exited with code ${result.exitCode ?? "unknown"}`,
    );

    return {
      status: result.success ? "completed" : "failed",
      result,
    };
  } finally {
    currentOperation.set(null);
  }
}
