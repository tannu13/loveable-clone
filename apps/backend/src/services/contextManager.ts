import type { Content } from "@google/genai";

export class ContextManager {
  private keepLastNTurns;

  constructor(keepLastNTurns = 5) {
    this.keepLastNTurns = keepLastNTurns;
  }

  compactHistory(messages: Content[]): Content[] {
    if (messages.length <= this.keepLastNTurns) return messages;

    const compactBeforeIdx = messages.length - this.keepLastNTurns;

    console.log("compacting msg", messages.length);

    const compactedMessages: Content[] = messages.map((msg, idx) => {
      if (idx >= compactBeforeIdx) return msg;

      if (msg.role === "model" && msg.parts) {
        msg.parts = msg.parts.map((part) => {
          const args = part.functionCall?.args;
          if (part.functionCall?.name === "writeFile" && args) {
            // only retain the file path, delete content
            delete args["content"];
            args["instruction"] =
              "Context Compacted. File written successfully. Use the read file tool directly to get the file contents";
          }
          return {
            ...part,
            functionCall: {
              ...part.functionCall,
              args,
            },
          };
        });
      }

      if (msg.role === "user" && msg.parts) {
        msg.parts = msg.parts.map((part) => {
          const toolName = part.functionResponse?.name;
          if (toolName === "listFile") {
            const fileList = part.functionResponse?.response?.["list"];
            let updatedFileList: { path: string }[] = [];
            if (Array.isArray(fileList)) {
              // only take the file path, skip content
              updatedFileList = fileList.map((f) => ({ path: f.path }));
            }

            return {
              ...part,
              functionResponse: {
                name: toolName,
                response: {
                  list: updatedFileList,
                  instruction:
                    "Context Compacted. Use the read file tool directly to get the file contents at specific path",
                },
              },
            };
          } else if (toolName === "readFile") {
            const response = part.functionResponse?.response;
            // only retain the file path, delete content
            if (response?.["content"]) {
              delete response["content"];
              response["instruction"] =
                "Context Compacted. Use the read file tool directly to get the file contents";
            }

            return {
              ...part,
              functionResponse: {
                ...part.functionResponse,
                response,
              },
            };
          }

          return part;
        });
      }

      return msg;
    });

    console.dir(compactedMessages, { depth: 15 });

    return compactedMessages;
  }
}
