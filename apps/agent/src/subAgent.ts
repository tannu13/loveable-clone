import { mkdirSync } from "node:fs";
import path from "node:path";
import { Harness } from "./services/agentServices/harness";
import {
  listFileTool,
  readFileTool,
  ToolRegistry,
  writeFileTool,
} from "./services/agentServices/tools";
import { SubAgentResponseHandler } from "./services/responseHandler";
import { getMainRepoPath } from "./utils/helpers";
import { initializeWorktree } from "./utils/git-worktree-utils";

const DEFAULT_ARTIFACT_DIR_PATH = path.resolve(
  import.meta.dirname,
  "../artifacts",
);

process.on("disconnect", () => {
  console.log("Parent process died or disconnected. Shutting down subagent.");
  process.exit(1);
});

const toolRegistry = new ToolRegistry();
toolRegistry
  .register(readFileTool)
  .register(writeFileTool)
  .register(listFileTool);

const agentId = process.argv[2];
const systemPrompt = process.argv[3];
const taskDescription = process.argv[4];

if (!agentId || !systemPrompt || !taskDescription) {
  console.error(
    "Error: Missing required arguments.\n" +
      "Usage: bun subAgent.ts <agentId> <systemPrompt> <taskDescription>",
  );
  process.exit(1);
}
const artifactPath = path.resolve(DEFAULT_ARTIFACT_DIR_PATH, agentId);

// create a worktree from the main workspace, parallel to it.
const mainRepoPath = getMainRepoPath();
const branchName = agentId;
const { worktreePath } = await initializeWorktree(mainRepoPath, branchName);

// pass in the new workspace dir to the harness

const responseHandler = new SubAgentResponseHandler(
  artifactPath,
  worktreePath,
  mainRepoPath,
  branchName,
);
const harness = new Harness({
  systemPrompt,
  toolRegistry,
  responseHandler,
  pastHistory: [],
  workspace: worktreePath,
});

harness.addUserPrompt(taskDescription);
harness.executeTask();
