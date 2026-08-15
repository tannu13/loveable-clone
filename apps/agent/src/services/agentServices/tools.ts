import { Type, type FunctionDeclaration } from "@google/genai";
import z from "zod";
import { waitForResponse } from "../comms";
import {
  commitWorkspace,
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
} from "./projectFiles";
import {
  QnASchema,
  qnaAskCodec,
  planAskCodec,
  type QnAAskPayload,
  type PlanAskPayload,
} from "@repo/shared";
import type { ResponseLifeCycle } from "../responseHandler";
import { startBuildingApp } from "./startBuildingApp";
import { fetchRunnerLogsAfterDelay } from "./runnerLogs";
import { SubAgentOrchestrator } from "../subAgentOrchestrator";
import path from "node:path";

interface AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  declaration: FunctionDeclaration;
  schema: S;
  summaryText: (args: z.infer<S>) => string;
  execute: (
    args: z.infer<S>,
    workspace: string,
    responseHandler: ResponseLifeCycle,
  ) => Promise<Record<string, unknown>>;
}

const RUNNER_LOG_DELAY_MS = 1500;
const RUNNER_LOG_LIMIT_AFTER_WRITE = 100;

const ListFileSchema = z.object({});
export const listFileTool: AgentTool<typeof ListFileSchema> = {
  name: "listFile",
  declaration: {
    name: "listFile",
    description:
      "This tool will read and give you a list of files along with the content of each file in the project which are to be changed",
    parametersJsonSchema: {
      type: "object",
      required: [],
    },
  },
  schema: ListFileSchema,
  summaryText: () => `Listing files available to the project`,
  execute: async (args, workspace) => {
    console.log("Listing files args", args);

    const list = await listProjectFiles(workspace);
    return { list };
  },
};

const ReadFileSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
});
export const readFileTool: AgentTool<typeof ReadFileSchema> = {
  name: "readFile",
  declaration: {
    name: "readFile",
    description:
      "Reads the content of a file from the local file system given its path.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The relative or absolute path to the file.",
        },
      },
      required: ["path"],
    },
  },
  schema: ReadFileSchema,
  summaryText: (args) => `Reading file @ ${args.path}`,
  execute: async (args, workspace) => {
    const content = await readProjectFile(workspace, args.path);
    return {
      file: args.path,
      content,
    };
  },
};

const WriteFileSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
  content: z.string().min(1, "Content cannot be empty"),
});
export const writeFileTool: AgentTool<typeof WriteFileSchema> = {
  name: "writeFile",
  declaration: {
    name: "writeFile",
    description: "Writes or overwrites content to a specified file path.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path where the file should be saved.",
        },
        content: {
          type: "string",
          description: "The text content to write into the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  schema: WriteFileSchema,
  summaryText: (args) => `Writing to file @ ${args.path}`,
  execute: async (args, workspace) => {
    await writeProjectFile(workspace, args.path, args.content);
    const runnerLogs = await fetchRunnerLogsAfterDelay({
      delayMs: RUNNER_LOG_DELAY_MS,
      limit: RUNNER_LOG_LIMIT_AFTER_WRITE,
      errorMessage: "Failed to fetch runner logs after file write",
    });

    return {
      file: args.path,
      write: true,
      runnerLogs,
    };
  },
};

const StartBuildingAppSchema = z.object({
  library: z.enum(["react", "vue"]),
});

export const startBuildingAppTool: AgentTool<typeof StartBuildingAppSchema> = {
  name: "startBuildingApp",
  declaration: {
    name: "startBuildingApp",
    description:
      "Use this tool if you want to start building a react app and there is no code available yet. This tool would download a starter react template code at the accessible location and provision anythting else needed for that app to be available. Do not start writing react app code files from scratch and instead use this tool to setup all the necessary environments.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        library: {
          type: Type.STRING,
          enum: ["react", "vue"],
          description:
            "provide the library name for which the starter template needs to be downloaded. can be either react or vue",
        },
      },
      required: ["library"],
    },
  },
  schema: StartBuildingAppSchema,
  summaryText: (args) => `Setting up the ${args.library} starter...`,
  execute: async (args) => startBuildingApp(args.library),
};

const DelegateSubAgentsSchema = z.object({
  subAgents: z.array(
    z.object({
      taskDescription: z.string().min(1),
    }),
  ),
});
export const delegateSubAgentsTool: AgentTool<typeof DelegateSubAgentsSchema> =
  {
    name: "delegateSubAgents",
    declaration: {
      name: "delegateSubAgents",
      description:
        "Delegates independent tasks to multiple sub-agents in parallel. For each subagent, create the task description and non-conflicting expected file ownership so that each agent can work on files in a non-conflicting way. Each sub-agent runs in an isolated Git worktree, generates a diff patch artifact upon completing its task, and returns the content to the patch artifact via a callback tool. The diff responses of this tool call then needs to be applied to the codebase via writing to the files",
      parameters: {
        type: Type.OBJECT,
        properties: {
          subAgents: {
            type: Type.ARRAY,
            description:
              "List of independent sub-agent tasks to run concurrently.",
            items: {
              type: Type.OBJECT,
              properties: {
                taskDescription: {
                  type: Type.STRING,
                  description:
                    "Detailed instructions on what code changes or files to modify.",
                },
              },
              required: ["taskDescription"],
            },
          },
        },
        required: ["subAgents"],
      },
    },
    schema: DelegateSubAgentsSchema,
    summaryText: (args) => `Spawning ${args.subAgents.length} sub agents...`,
    execute: async (args) => {
      const parentAgentId = crypto.randomUUID();
      const orchestrator = new SubAgentOrchestrator(parentAgentId);

      const subAgentSystemPromptPath = path.resolve(
        import.meta.dirname,
        "./prompts/coding-agent-system-prompt",
      );
      let systemPrompt = "";
      try {
        systemPrompt = await Bun.file(subAgentSystemPromptPath).text();
      } catch {
        systemPrompt = "You are a coding assistant";
      }

      args.subAgents.forEach(({ taskDescription }) => {
        const agentId = crypto.randomUUID();
        orchestrator.addAgent({ agentId, systemPrompt, taskDescription });
      });

      try {
        const subAgentResponse = await orchestrator.spawnAgents();
        return { subAgentResponse };
      } catch (err: unknown) {
        if (err instanceof Error) {
          return { error: err.message };
        }
        return { error: err };
      }
    },
  };

const GitCommitSchema = z.object({
  commitMessage: z.string().min(1, "Commit message cannot be empty"),
});
export const gitCommitTool: AgentTool<typeof GitCommitSchema> = {
  name: "gitCommit",
  declaration: {
    name: "gitCommit",
    description: `Executes a git commit on the workspace to commit the current set of completed changes.
      WHEN TO USE:
      - Call this only near the end of the current task, after all file edits and write operations are complete.
      - Requires that at least one write tool call has been executed during the current task.
      - Call it only when you do not expect to make any further file edits or write tool calls for the current task.

      DO NOT USE:
      - Do not call after every individual write tool call.
      - Do not call if additional file edits or write tool calls are still expected for the current task.`,
    parametersJsonSchema: {
      type: "object",
      properties: {
        commitMessage: {
          type: "string",
          description:
            "Give a short, imperative subject line (under 50 characters) and use the message body to explain why the change was made rather than how.",
        },
      },
      required: ["commitMessage"],
    },
  },
  schema: GitCommitSchema,
  summaryText: () => `Saving the current changes to repo...`,
  execute: async (args, workspace) => {
    try {
      await commitWorkspace(workspace, args.commitMessage);
      return { status: "Workspace state committed" };
    } catch (err: unknown) {
      let errorMessage = err instanceof Error ? err.message : String(err);
      return { status: errorMessage };
    }
  },
};

export const qnaTool: AgentTool<typeof QnASchema> = {
  name: "qnaTool",
  declaration: {
    name: "qnaTool",
    description:
      "Use this tool to ask questions to the user which will be answered by them. Asks user questions with multiple options provided for them to select one.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description:
            "Provide this as a summary of all the questions that you ask as short as possible. Also, keep a placeholder for answers per question. The format should be, if there were 3 questions - Question1_Summarised_Text##<ANSWER_PLACEHOLDER>::Question2_Summarised_Text##<ANSWER_PLACEHOLDER>::Question3_Summarised_Text##<ANSWER_PLACEHOLDER>",
        },
        questions: {
          type: Type.ARRAY,
          description:
            "An array of question objects, each containing the question text, type, and available options.",
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "The text of the question. Must not be empty.",
              },
              inputType: {
                type: Type.STRING,
                enum: ["select"],
                description:
                  "The type of the question. This is a literal value fixed to 'select'.",
              },
              options: {
                type: Type.ARRAY,
                description:
                  "A list of text options for the user to select from.",
                items: {
                  type: Type.STRING,
                },
              },
            },
            required: ["question", "inputType", "options"],
          },
        },
      },
      required: ["summary", "questions"],
    },
  },
  schema: QnASchema,
  summaryText(_args) {
    return `Need more info, asking question(s) to user`;
  },
  execute: async (args, _workspace, responseHandler) => {
    // Built once and reused for both the live emit and the DB write so the
    // two can never diverge — see qnaAskCodec in @repo/shared.
    const payload: QnAAskPayload = {
      correlationId: crypto.randomUUID(),
      questions: args.questions,
    };

    responseHandler.send("qna", payload);
    await responseHandler.saveToDB({ type: "qna", ...qnaAskCodec.toRow(payload) });

    const userAnswer = await waitForResponse(payload.correlationId);
    await responseHandler.saveToDB({
      type: "qna",
      content: "",
      metadata: userAnswer,
      role: "user",
    });

    return { userAnswer, summary: args.summary };
  },
};

const UpdatePlanSchema = z.object({
  summary: z.string().min(1, "Summary is mandatory"),
  explanation: z.string().optional(),
  plan: z.array(
    z.object({
      step: z.string().min(1, "Step for each plan item is mandatory"),
      status: z.enum(["pending", "in_progress", "completed"]),
    }),
  ),
});
export const updatePlanTool: AgentTool<typeof UpdatePlanSchema> = {
  name: "updatePlan",
  declaration: {
    name: "updatePlan",
    description:
      "Use this tool to create and update the task plan. This is shown to the users so that they can see the plan items and their individual status. You can also pass in an optional explanation for the task plan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description:
            "Provide a very short summary of the plan and one statement summary of all the steps involved in the plan in following format (if there were 3 steps in the current plan): <PLAN_STATUS_PLACEHOLDER>##Plan_Summary_Text##Summarised_Step_1_Text::Summarised_Step_2_Text::Summarised_Step_3_Text",
        },
        explanation: {
          type: Type.STRING,
          description: "A brief summary of the task plan",
        },
        plan: {
          type: Type.ARRAY,
          description:
            "An array of plan item objects, each containing the step text and current status of the step",
          items: {
            type: Type.OBJECT,
            properties: {
              step: {
                type: Type.STRING,
                description:
                  "The summary of this step on what is or would be done in it.",
              },
              status: {
                type: Type.STRING,
                enum: ["pending", "in_progress", "completed"],
                description:
                  "One of pending, in_progress or completed depicting the current status of this step",
              },
            },
            required: ["step", "status"],
          },
        },
      },
      required: ["plan", "summary"],
    },
  },
  schema: UpdatePlanSchema,
  summaryText(_args) {
    return `Finalizing plan...`;
  },
  execute: async (args, _workspace, responseHandler) => {
    // Same pattern as qnaTool: one payload feeds both the live emit and the
    // DB write — see planAskCodec in @repo/shared.
    const payload: PlanAskPayload = {
      explanation: args.explanation,
      plan: args.plan,
    };

    responseHandler.send("plan", payload);
    await responseHandler.saveToDB({ type: "plan", ...planAskCodec.toRow(payload) });

    return { message: "Plan updates sent to user" };
  },
};

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getGiminiDeclarations() {
    return Array.from(this.tools.values()).map((t) => t.declaration);
  }
}
