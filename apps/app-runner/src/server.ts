import { spawn, type Subprocess } from "bun";
import express, { type Request, type Response } from "express";
import z from "zod";
import env from "./env";
import { appendLog, runExclusivePackageCommand, streamOutput } from "./helpers";
import { validate } from "./middlewares/validate";
import {
  PackageOperationSchema,
  type TPackageOperationSchema,
} from "./types/validations";
import { currentOperation } from "./services/currentOperation";
import { logs } from "./services/logBuffer";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let devServerProcess: Subprocess | null = null;
let lastDevExitCode: number | null = null;

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

app.post("/start", (_req: Request, res: Response) => {
  if (devServerProcess) {
    return res.status(200).json({ status: "already_running" });
  }

  lastDevExitCode = null;
  appendLog("dev", "system", "Starting dev server");

  devServerProcess = spawn(
    [
      "bun",
      "run",
      "dev",
      "--",
      "--host",
      env.DEV_HOST,
      "--port",
      String(env.DEV_PORT),
    ],
    {
      cwd: env.APP_DIR,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  streamOutput(devServerProcess.stdout as ReadableStream<Uint8Array>, (text) =>
    appendLog("dev", "stdout", text),
  );
  streamOutput(devServerProcess.stderr as ReadableStream<Uint8Array>, (text) =>
    appendLog("dev", "stderr", text),
  );

  (async () => {
    const process = devServerProcess;
    const exitCode = await process?.exited;
    lastDevExitCode = exitCode ?? null;
    appendLog("dev", "system", `Dev server exited with code ${exitCode}`);
    if (devServerProcess === process) {
      devServerProcess = null;
    }
  })();

  return res.status(200).json({
    status: "started",
    appDir: env.APP_DIR,
    host: env.DEV_HOST,
    port: env.DEV_PORT,
  });
});

app.post("/stop", async (_req: Request, res: Response) => {
  if (!devServerProcess) {
    return res.status(200).json({ status: "not_running" });
  }

  const process = devServerProcess;
  appendLog("dev", "system", "Stopping dev server");
  process.kill();

  const exitCode = await process.exited;
  lastDevExitCode = exitCode;
  devServerProcess = null;

  return res.status(200).json({ status: "stopped", exitCode });
});

app.post("/restart", async (_req: Request, res: Response) => {
  if (devServerProcess) {
    const process = devServerProcess;
    appendLog("dev", "system", "Restarting dev server");
    process.kill();
    lastDevExitCode = await process.exited;
    devServerProcess = null;
  }

  lastDevExitCode = null;
  appendLog("dev", "system", "Starting dev server");

  devServerProcess = spawn(
    [
      "bun",
      "run",
      "dev",
      "--",
      "--host",
      env.DEV_HOST,
      "--port",
      String(env.DEV_PORT),
    ],
    {
      cwd: env.APP_DIR,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  streamOutput(devServerProcess.stdout as ReadableStream<Uint8Array>, (text) =>
    appendLog("dev", "stdout", text),
  );
  streamOutput(devServerProcess.stderr as ReadableStream<Uint8Array>, (text) =>
    appendLog("dev", "stderr", text),
  );

  (async () => {
    const process = devServerProcess;
    const exitCode = await process?.exited;
    lastDevExitCode = exitCode ?? null;
    appendLog("dev", "system", `Dev server exited with code ${exitCode}`);
    if (devServerProcess === process) {
      devServerProcess = null;
    }
  })();

  return res.status(200).json({
    status: "restarted",
    appDir: env.APP_DIR,
    host: env.DEV_HOST,
    port: env.DEV_PORT,
  });
});

app.post("/install", async (_req: Request, res: Response) => {
  const result = await runExclusivePackageCommand("install", "bun", [
    "install",
  ]);
  const statusCode = result.status === "busy" ? 409 : 200;

  return res.status(statusCode).json({
    ...result,
    appDir: env.APP_DIR,
  });
});

app.post(
  "/package/add",
  validate("body", PackageOperationSchema),
  async (req: Request, res: Response) => {
    const { packages } = req.body as TPackageOperationSchema;
    const result = await runExclusivePackageCommand("package", "bun", [
      "add",
      ...packages,
    ]);
    const statusCode = result.status === "busy" ? 409 : 200;

    return res.status(statusCode).json({
      ...result,
      packages: packages,
      appDir: env.APP_DIR,
    });
  },
);

app.post(
  "/package/remove",
  validate("body", PackageOperationSchema),
  async (req: Request, res: Response) => {
    const { packages } = req.body as TPackageOperationSchema;
    const result = await runExclusivePackageCommand("package", "bun", [
      "remove",
      ...packages,
    ]);
    const statusCode = result.status === "busy" ? 409 : 200;

    return res.status(statusCode).json({
      ...result,
      packages: packages,
      appDir: env.APP_DIR,
    });
  },
);

app.get("/status", (_req: Request, res: Response) => {
  return res.status(200).json({
    appDir: env.APP_DIR,
    devServer: {
      running: devServerProcess !== null,
      lastExitCode: lastDevExitCode,
      host: env.DEV_HOST,
      port: env.DEV_PORT,
    },
    operation: currentOperation.get(),
  });
});

app.get("/logs", (req: Request, res: Response) => {
  const since = Number(req.query.since ?? 0);
  const limit = Number(req.query.limit ?? 100);
  const normalizedLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 500)
    : 100;

  return res.status(200).json({
    logs: logs.list({
      since: Number.isFinite(since) ? since : 0,
      limit: normalizedLimit,
    }),
  });
});

export default app;
export { app };
