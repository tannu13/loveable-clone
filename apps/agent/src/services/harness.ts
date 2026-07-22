import { Agent } from "./agent";
import {
  HooksRegistry,
  ValidateToolCallHook,
  type PreToolCallContext,
} from "./hooks";
import { ToolRegistry } from "./tools";
import { ContextManager } from "./contextManager";
import type {
  Content,
  FunctionCall,
  GenerateContentResponse,
  Part,
} from "@google/genai";
import env from "../env";
import type { ResponseHandler } from "./responseHandler";

const sleep = (ms: number) => {
  return new Promise((res) => setTimeout(res, ms));
};

const CONTEXT_TOKEN_THRESHOLD = 5000;
const CONTEXT_SUMMARIZATION_MARK = 0.8;
export class Harness {
  private agent: Agent;
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private maxIterations = 15;
  private hooksRegistry: HooksRegistry;
  private responseHandler: ResponseHandler;
  private currentPromptTokens = 0;

  status = "pending";

  constructor(responseHandler: ResponseHandler, pastHistory: Content[]) {
    this.responseHandler = responseHandler;
    this.agent = new Agent(env.GEMINI_API_KEY);
    if (pastHistory.length > 0) {
      this.agent.setHistory(pastHistory);
    }

    this.toolRegistry = new ToolRegistry();
    this.contextManager = new ContextManager();

    this.hooksRegistry = new HooksRegistry();
    const validateHook = new ValidateToolCallHook();
    this.hooksRegistry.register("pre-tool-call", validateHook);
  }

  addUserPrompt(message: string) {
    this.agent.addUserRole([{ text: message }]);
  }

  async handleErrorGracefully(
    stepRunner: Promise<AsyncGenerator<GenerateContentResponse, any, any>>,
    retries = 3,
    delay = 1000,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        return await stepRunner;
      } catch (error: any) {
        // Check for 500 or 503 internal/service unavailable errors
        if (error.status === 500 && i < retries - 1) {
          console.warn(
            `Internal server error. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }
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
        let wasSummarized = false;

        if (triggerSummarization) {
          messageHistory =
            await this.contextManager.summarizeHistory(messageHistory);
          wasSummarized = true;
          triggerSummarization = false;
        } else {
          messageHistory = this.contextManager.compactHistory(messageHistory);
        }

        const originalTokensBeforeCompression = this.currentPromptTokens;
        this.agent.setHistory(messageHistory);

        const { totalTokens: newHistoryTokens } = await this.agent.countTokens(
          messageHistory,
          this.toolRegistry,
        );
        this.currentPromptTokens = newHistoryTokens || 0;
        if (!wasSummarized && newHistoryTokens) {
          const compactionRatio =
            newHistoryTokens / originalTokensBeforeCompression;

          // If the history is still > 80% of its original size, compaction was ineffective.
          // Escalate to summarization for the NEXT time the threshold is breached. - ref: manus
          if (compactionRatio > CONTEXT_SUMMARIZATION_MARK) {
            triggerSummarization = true;
          }
        }
      }

      await this.hooksRegistry.executeHooks("pre-llm-call", {
        rawHistory: messageHistory,
      });

      const responseStream = await this.handleErrorGracefully(
        this.agent.runStep(messageHistory, this.toolRegistry),
      );
      if (!responseStream) {
        continue;
      }

      let finalUsage: GenerateContentResponse["usageMetadata"] | undefined;
      let accumulatedText = "";
      const pendingFunctionCalls: FunctionCall[] = [];
      let modelPartsFromStream: Part[] = [];

      for await (const chunk of responseStream) {
        if (chunk.text) {
          accumulatedText += chunk.text;
          this.responseHandler.send("text", chunk.text);
        }

        // Collect candidate parts emitted during streaming
        const candidateParts = chunk.candidates?.[0]?.content?.parts;
        if (candidateParts && candidateParts.length > 0) {
          modelPartsFromStream.push(...candidateParts);
        }

        // Collect function calls emitted during streaming
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          pendingFunctionCalls.push(...chunk.functionCalls);
        }

        if (chunk.usageMetadata) {
          finalUsage = chunk.usageMetadata;
        }
      }

      this.currentPromptTokens = finalUsage?.totalTokenCount || 0;

      if (accumulatedText.trim().length > 0) {
        this.agent.addModelRole([{ text: accumulatedText }]);
      }
      if (pendingFunctionCalls.length > 0) {
        this.agent.addModelRole(modelPartsFromStream);
        const toolResponseParts = [];
        for (const fn of pendingFunctionCalls) {
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
            this.responseHandler.send(
              "text",
              tool.summaryText(parseResult.data),
            );

            const result = await tool.execute(
              parseResult.data as any,
              this.responseHandler,
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
        console.log("Final Response: ", accumulatedText);
        console.dir(finalUsage, { depth: 5 });
        console.dir(this.agent.getHistory(), { depth: 10 });
        processing = false;

        this.responseHandler.end();
        this.responseHandler.backupHistory(this.agent.getHistory());
        this.responseHandler.saveToDB({
          type: "text",
          content: accumulatedText,
        });
      }
    }

    if (iteration >= this.maxIterations) {
      console.warn("Harness hit safety iteration limit guardrail.");
    }
  }
}
