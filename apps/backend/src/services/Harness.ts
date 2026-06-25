import type { Response } from "express";
import type { Agent } from "./Agent";
import type {
  ToolRegistry,
  TQnASchema,
  TReadFileSchema,
  TWriteFileSchema,
} from "./ToolRegistry";

export class Harness {
  private agent: Agent;
  private toolRegistry: ToolRegistry;
  private responseStream: Response;
  private maxIterations: number;

  private comms: ((value: string) => void) | null = null;
  private pendingMsgs: string[] = [];

  status = "pending";

  constructor(
    agent: Agent,
    toolRegistry: ToolRegistry,
    res: Response,
    maxIterations = 5,
  ) {
    this.agent = agent;
    this.toolRegistry = toolRegistry;
    this.responseStream = res;
    this.maxIterations = maxIterations;
  }

  async syncUp(): Promise<string> {
    if (this.pendingMsgs.length > 0) {
      const reply = this.pendingMsgs.join(", ");
      this.pendingMsgs = [];
      return reply;
    }
    const a = new Promise<string>((res, _rej) => {
      this.comms = res;
    });
    return a;
  }

  async executeTask() {
    let iteration = 0;
    let processing = true;
    while (processing && iteration < this.maxIterations) {
      iteration++;

      // const rawHistory = this.agent.getHistory();

      const response = await this.agent.runStep(this.toolRegistry);

      if (response.functionCalls) {
        this.agent.addModelRole(
          response.functionCalls.map((call) => ({ functionCall: call })),
        );

        const toolResponseParts = [];
        for (const fn of response.functionCalls) {
          const tool = this.toolRegistry.get(fn.name!);
          if (!tool) {
            console.warn(
              `LLM attempted to call unregistered tool: "${fn.name}"`,
            );
            continue;
          }

          // const parseResult = tool.schema.safeParse(fn.args);
          // if (!parseResult.success) {
          //   console.error(
          //     `Validation failed for tool '${tool.name}'. Errors:`,
          //     parseResult.error.flatten(),
          //   );
          //   continue;
          // }

          try {
            if (this.comms !== null) {
              if (tool.name === "readFile") {
                const parsedData = fn.args as TReadFileSchema;
                this.comms(`Reading File ${parsedData.path}`);
              } else if (tool.name === "writeFile") {
                const parsedData = fn.args as TWriteFileSchema;
                this.comms(`Writing to File ${parsedData.path}`);
              } else if (tool.name === "qnaTool") {
                const parsedData = fn.args as TQnASchema;
                this.comms(
                  `Asking user questions ${parsedData.questions.map((q) => q.question).join(", ")}`,
                );
              }
            } else {
              if (tool.name === "readFile") {
                const parsedData = fn.args as TReadFileSchema;
                this.pendingMsgs.push(`Reading File ${parsedData.path}`);
              } else if (tool.name === "writeFile") {
                const parsedData = fn.args as TWriteFileSchema;
                this.pendingMsgs.push(`Writing to File ${parsedData.path}`);
              }
            }

            const result = await tool.execute({
              ...fn.args,
              responseStream: this.responseStream,
            } as any);
            toolResponseParts.push({
              functionResponse: {
                name: tool.name,
                response: result,
              },
            });

            // call post hooks
          } catch (err) {
            console.error(`Runtime error executing ${tool.name}`, err);
          }
        }

        this.agent.addUserRole(toolResponseParts);
      } else {
        // no tool calls
        console.log("Final Response: ", response.text);
        console.dir(response.usageMetadata, { depth: 5 });
        processing = false;
        if (this.comms !== null) {
          this.comms(`FIN##Calling ${response.text}`);
        }
      }
    }

    if (iteration >= this.maxIterations) {
      console.warn("Harness hit safety iteration limit guardrail.");
    }
  }
}
