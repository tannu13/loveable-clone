import type { Content } from "@google/genai";

export class ContextManager {
  private keepLastNTurns;

  constructor(keepLastNTurns = 5) {
    this.keepLastNTurns = keepLastNTurns;
  }

  compactHistory(messages: Content[]): Content[] {
    if (messages.length <= this.keepLastNTurns) return messages;

    const compactBeforeIdx = messages.length - this.keepLastNTurns;

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

          if (part.functionCall?.name === "updatePlan" && args) {
            if (Array.isArray(args["plan"])) {
              const allCompleted = args["plan"].every(
                (p) => p.status === "completed",
              );
              if (allCompleted && typeof args["summary"] === "string") {
                const withoutStatusArr = args["summary"].split("##").slice(1);
                args["summary"] = [
                  "All Steps Completed",
                  ...withoutStatusArr,
                ].join("##");
                delete args["explanation"];
                delete args["plan"];
              }
            }
          }

          if (part.functionCall?.name === "qnaTool" && args) {
            // use the summary value and remove the questions array
            delete args["questions"];
            args["instruction"] =
              "Context Compacted. Summary field has info in format `Question_Text##Selected_Answer::Question_Text##Selected_Answer`";

            const userResponseMessage = messages[idx + 1];
            if (
              userResponseMessage &&
              userResponseMessage?.role === "user" &&
              userResponseMessage?.parts
            ) {
              // get the answers

              const responsePartIdx = userResponseMessage.parts.findIndex(
                (p) => p.functionResponse?.name === "qnaTool",
              );
              if (responsePartIdx >= 0 && userResponseMessage.parts) {
                if (
                  Array.isArray(
                    userResponseMessage.parts[responsePartIdx]!.functionResponse
                      ?.response?.userAnswer,
                  )
                ) {
                  const answers: string[] = userResponseMessage.parts[
                    responsePartIdx
                  ]!.functionResponse?.response?.userAnswer.map(
                    (a) => a.selectedOption,
                  );
                  let idx = 0;

                  if (typeof args["summary"] === "string") {
                    args["summary"] = args["summary"].replace(
                      /<ANSWER_PLACEHOLDER>/g,
                      () => {
                        return (
                          answers[idx++] ??
                          "<Missed selection. Ask again using the qna tool>"
                        );
                      },
                    );
                  }
                }
              }
              messages[idx + 1] = {
                ...userResponseMessage,
              };
            }
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
          } else if (toolName === "qnaTool") {
            const response = part.functionResponse?.response;
            if (Array.isArray(response?.["userAnswer"])) {
              const answers = response["userAnswer"].map(
                (a) => a.selectedOption,
              );

              let idx = 0;
              if (typeof response["summary"] === "string") {
                response["summary"] = response["summary"].replace(
                  /<ANSWER_PLACEHOLDER>/g,
                  () => {
                    return (
                      answers[idx++] ??
                      "<Missed selection. Ask again using the qna tool>"
                    );
                  },
                );
              }

              delete response["userAnswer"];
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
