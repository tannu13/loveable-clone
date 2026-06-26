import env from "../env";
import { Agent } from "./agent";
import {
  HooksRegistry,
  ValidateToolCallHook,
  type PreToolCallContext,
} from "./hooks";
import { ToolRegistry } from "./tools";

const sleep = (ms: number) => {
  return new Promise((res) => setTimeout(res, ms));
};

export class Harness {
  private agent: Agent;
  private toolRegistry: ToolRegistry;
  private maxIterations = 5;
  private hooksRegistry: HooksRegistry;
  private sendResponse: (payload: string) => void;
  private endResponse: () => void;

  status = "pending";

  constructor(
    initialPrompt: string,
    sendResponse: (payload: string) => void,
    endResponse: () => void,
  ) {
    this.sendResponse = sendResponse;
    this.endResponse = endResponse;
    this.agent = new Agent(
      env.GEMINI_API_KEY,
      initialPrompt,
      // "ask me a few questions on what i think about react",
    );

    this.toolRegistry = new ToolRegistry();

    this.hooksRegistry = new HooksRegistry();
    const validateHook = new ValidateToolCallHook();
    this.hooksRegistry.register("pre-tool-call", validateHook);
  }

  async executeTask() {
    let iteration = 0;
    let processing = true;
    while (processing && iteration < this.maxIterations) {
      iteration++;

      await sleep(3000);

      const rawHistory = this.agent.getHistory();

      await this.hooksRegistry.executeHooks("pre-llm-call", {
        rawHistory,
      });

      const response = await this.agent.runStep(this.toolRegistry, rawHistory);

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

          const parseResult = tool.schema.safeParse(fn.args);
          if (!parseResult.success) {
            console.error(
              `Validation failed for tool '${tool.name}'. Errors:`,
              parseResult.error.flatten(),
            );
            continue;
          }

          let isApproved = true;
          const rejectionReasons: string[] = [];
          const contextPayload: PreToolCallContext = {
            history: this.agent.getHistory(),
            toolName: tool.name,
            args: parseResult.data as Record<string, unknown>,
            approve: () => {
              if (rejectionReasons.length > 0) {
                isApproved = false;
              }
            },
            reject: (reason) => {
              isApproved = false;
              rejectionReasons.push(reason);
            },
          };

          await this.hooksRegistry.executeHooks(
            "pre-tool-call",
            contextPayload,
          );
          if (!isApproved || rejectionReasons.length > 0) {
            toolResponseParts.push({
              functionResponse: {
                name: tool.name,
                response: {
                  status: "error",
                  error: `Tool call to ${tool.name} was rejected by guardrail hooks due to following reasons: ${rejectionReasons.join(", ")}`,
                },
              },
            });
            continue;
          }

          try {
            // streaming tool call summary back to user
            this.sendResponse(tool.summaryText(parseResult.data));

            const result = await tool.execute(
              parseResult.data as any,
              this.sendResponse,
            );
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
        this.sendResponse(JSON.stringify(response.text) || "Agent finished");
        this.endResponse();
      }
    }

    if (iteration >= this.maxIterations) {
      console.warn("Harness hit safety iteration limit guardrail.");
    }
  }
}
