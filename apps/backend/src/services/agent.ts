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
  private model = "gemma-4-26b-a4b-it";

  constructor(apiKey: string, initialPrompt: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.addUserRole([{ text: initialPrompt }]);
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
    return await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: {
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
    registry: ToolRegistry,
    contents: Content[] = this.history,
  ) {
    const declarations = registry.getGiminiDeclarations();
    return await this.ai.models.countTokens({
      model: this.model,
      contents,
      config: {
        tools: [{ functionDeclarations: declarations }],
      },
    });
  }
}
