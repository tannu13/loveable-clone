import type { SendResponse } from "@repo/shared";
import env from "../env";
import { Agent } from "./agent";
import {
  HooksRegistry,
  ValidateToolCallHook,
  type PreToolCallContext,
} from "./hooks";
import { ToolRegistry } from "./tools";
import { ContextManager } from "./contextManager";

const sleep = (ms: number) => {
  return new Promise((res) => setTimeout(res, ms));
};

const CONTEXT_TOKEN_THRESHOLD = 1000;
const CONTEXT_SUMMARIZATION_MARK = 0.2;
export class Harness {
  private agent: Agent;
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private maxIterations = 15;
  private hooksRegistry: HooksRegistry;
  private sendResponse: SendResponse;
  private endResponse: () => void;
  private currentPromptTokens = 0;

  status = "pending";

  constructor(
    initialPrompt: string,
    sendResponse: SendResponse,
    endResponse: () => void,
  ) {
    this.sendResponse = sendResponse;
    this.endResponse = endResponse;
    this.agent = new Agent(env.GEMINI_API_KEY, initialPrompt);

    this.toolRegistry = new ToolRegistry();
    this.contextManager = new ContextManager();

    this.hooksRegistry = new HooksRegistry();
    const validateHook = new ValidateToolCallHook();
    this.hooksRegistry.register("pre-tool-call", validateHook);
  }

  async executeTask() {
    let iteration = 0;
    let processing = true;
    let triggerSummarization = false;
    while (processing && iteration < this.maxIterations) {
      iteration++;

      await sleep(5000);

      let messageHistory = this.agent.getHistory();

      // context compaction or summarization
      if (this.currentPromptTokens > CONTEXT_TOKEN_THRESHOLD) {
        if (triggerSummarization) {
          triggerSummarization = false;
          messageHistory = []; // do summarization here, how??
        } else {
          messageHistory = this.contextManager.compactHistory(messageHistory);
        }

        const { totalTokens: totalTokensAfterCompaction } =
          await this.agent.countTokens(this.toolRegistry, messageHistory);

        if (
          totalTokensAfterCompaction &&
          totalTokensAfterCompaction / this.currentPromptTokens <
            CONTEXT_SUMMARIZATION_MARK
        ) {
          // the gains from compaction are minimal, so mark next cycle for summarization instead of compaction
          triggerSummarization = true;
        }
      }

      await this.hooksRegistry.executeHooks("pre-llm-call", {
        rawHistory: messageHistory,
      });

      const response = await this.agent.runStep(
        this.toolRegistry,
        messageHistory,
      );
      this.currentPromptTokens = response.usageMetadata?.totalTokenCount || 0;

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
            this.sendResponse("text", tool.summaryText(parseResult.data));

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
        console.dir(this.agent.getHistory(), { depth: 10 });
        processing = false;
        this.sendResponse(
          "text",
          JSON.stringify(response.text) || "Agent finished",
        );
        this.endResponse();
      }
    }

    if (iteration >= this.maxIterations) {
      console.warn("Harness hit safety iteration limit guardrail.");
    }
  }
}
