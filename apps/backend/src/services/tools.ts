import { Type, type FunctionDeclaration } from "@google/genai";
import z from "zod";
import { waitForResponse } from "./comms";
import {
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
} from "./projectFiles";
import { QnASchema, type SendResponse } from "@repo/shared";

interface AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  declaration: FunctionDeclaration;
  schema: S;
  summaryText: (args: z.infer<S>) => string;
  execute: (
    args: z.infer<S>,
    sendResponse: SendResponse,
  ) => Promise<Record<string, unknown>>;
}

const ListFileSchema = z.object({});
export const listFileTool: AgentTool<typeof ListFileSchema> = {
  name: "listFile",
  declaration: {
    name: "listFile",
    description:
      "This tool will read and give you a list of files and their content in the project which are to be changed",
    parametersJsonSchema: {
      type: "object",
      required: [],
    },
  },
  schema: ListFileSchema,
  summaryText: () => `Listing files available to the project`,
  execute: async (args) => {
    console.log("Listing files args", args);

    const list = await listProjectFiles();
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
  execute: async (args) => {
    const content = await readProjectFile(args.path);
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
  execute: async (args) => {
    await writeProjectFile(args.path, args.content);
    return {
      file: args.path,
      write: true,
    };
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
  execute: async (args, sendResponse) => {
    const correlationId = crypto.randomUUID();
    sendResponse("qna", {
      correlationId,
      questions: args.questions,
    });

    const userAnswer = await waitForResponse(correlationId);
    return { userAnswer, summary: args.summary };
  },
};

const UpdatePlanSchema = z.object({
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
      required: ["plan"],
    },
  },
  schema: UpdatePlanSchema,
  summaryText(_args) {
    return `Finalizing plan...`;
  },
  execute: async (args, sendResponse) => {
    sendResponse("plan", {
      explanation: args.explanation,
      plan: args.plan,
    });

    return { message: "Plan updates sent to user" };
  },
};

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  constructor() {
    this.register(readFileTool)
      .register(writeFileTool)
      .register(qnaTool)
      .register(updatePlanTool)
      .register(listFileTool);
  }

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
