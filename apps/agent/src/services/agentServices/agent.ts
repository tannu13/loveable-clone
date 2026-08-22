import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type Part,
} from "@google/genai";
import type { ToolRegistry } from "./tools";

export class Agent {
  private ai: GoogleGenAI;
  private history: Content[] = [];
  // private model = "gemma-4-26b-a4b-it";
  private systemPrompt = "";
  private model = "gemini-3.5-flash-lite";

  constructor(apiKey: string, systemPrompt: string) {
    this.systemPrompt = systemPrompt;
    this.ai = new GoogleGenAI({ apiKey });
  }

  getHistory() {
    return this.history;
  }

  setHistory(updatedHistory: Content[]) {
    this.history = updatedHistory;
  }

  addUserRole(parts: Part[]) {
    this.history.push({
      role: "user",
      parts,
    });
  }

  addModelRole(parts: Part[]) {
    this.history.push({
      role: "model",
      parts,
    });
  }

  async runStep(contents: Content[] = this.history, registry?: ToolRegistry) {
    const declarations = registry?.getGiminiDeclarations() || [];
    return this.ai.models.generateContentStream({
      model: this.model,
      contents,
      config: {
        systemInstruction: this.systemPrompt,
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
            // allowedFunctionNames: ["readFile", "writeFile"],
          },
        },
        tools: [{ functionDeclarations: declarations }],
      },
    });
  }

  async countTokens(
    contents: Content[] = this.history,
    registry: ToolRegistry,
  ) {
    const declarations = registry.getGiminiDeclarations();
    return this.ai.models.countTokens({
      model: this.model,
      contents,
      config: {
        tools: [{ functionDeclarations: declarations }],
      },
    });
  }
}
