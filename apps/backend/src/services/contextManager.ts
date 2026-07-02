import type { Content, Part } from "@google/genai";
import { Agent } from "./agent";
import env from "../env";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUMMARIZER_SYSTEM_PROMPT = ``;
export class ContextManager {
  private keepLastNTurns;

  constructor(keepLastNTurns = 5) {
    this.keepLastNTurns = keepLastNTurns;
  }

  async summarizeHistory(messages: Content[]): Promise<Content[]> {
    if (messages.length <= this.keepLastNTurns) return messages;

    let compactBeforeIdx = messages.length - this.keepLastNTurns;

    // after summarization, all the messages will be squished into one user message,
    // the next message would be a hardcoded message on agent's behalf saying "it accepts the summary" something
    // so adjust the messages being shrunk end at the agent's msg so that the next message is of a user.
    // so that when they are stiched back together, they make one linear history.
    if (
      !messages[compactBeforeIdx] ||
      messages[compactBeforeIdx]?.role === "model"
    ) {
      compactBeforeIdx--;
    }
    const oldHistoryChunk = messages.slice(0, compactBeforeIdx);

    const currentFile = fileURLToPath(import.meta.url);
    const currentDirectory = path.dirname(currentFile);

    const summarizerPrompt = await readFile(
      `${currentDirectory}/prompts/summarizer-system-prompt`,
      "utf-8",
    );

    const agent = new Agent(env.GEMINI_API_KEY, "Summarize the below history");
    oldHistoryChunk.push({
      role: "user",
      parts: [{ text: summarizerPrompt }],
    });
    const response = await agent.runStep(oldHistoryChunk);

    const part: Part = {
      text: response.text,
    };

    const summarizedHistory = [
      {
        role: "user",
        parts: [part],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I have reviewed the architectural summary and the files modified so far. I am ready to continue.",
          },
        ],
      },
      ...messages.slice(compactBeforeIdx),
    ];

    return summarizedHistory;
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
