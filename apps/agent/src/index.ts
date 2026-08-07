import { setupComms } from "./services/redis";
import { WorkerService } from "./services/workerService";
import { Harness } from "./services/agentServices/harness";
import { s3Service } from "./services/s3Service";
import type { Content } from "@google/genai";
import { UserResponseHandler } from "./services/responseHandler";
import {
  listFileTool,
  qnaTool,
  readFileTool,
  startBuildingAppTool,
  ToolRegistry,
  updatePlanTool,
  writeFileTool,
} from "./services/agentServices/tools";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { getMainRepoPath } from "./utils/helpers";

const { subscriber, publisher } = await setupComms();
const responseHandler = new UserResponseHandler(
  publisher,
  s3Service.uploadToS3,
);

let pastHistory: Content[] = [];
const historyFromBackup = (await s3Service.loadBackupFromS3()) as {
  history: Content[];
} | null;
if (historyFromBackup) {
  pastHistory = historyFromBackup.history;
}

const toolRegistry = new ToolRegistry();
toolRegistry
  .register(readFileTool)
  .register(writeFileTool)
  .register(startBuildingAppTool)
  .register(qnaTool)
  .register(updatePlanTool)
  .register(listFileTool);

const systemPromptFilePath = path.resolve(
  import.meta.dirname,
  "./services/agentServices/prompts/coding-agent-system-prompt",
);
const systemPrompt = await readFile(systemPromptFilePath, "utf-8");

const harness = new Harness({
  systemPrompt,
  toolRegistry,
  responseHandler,
  pastHistory,
  workspace: getMainRepoPath(),
});
const worker = new WorkerService({ subscriber, harness });

worker.listenForJobs();
