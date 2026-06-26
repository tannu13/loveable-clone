export type ProjectFile = {
  path: string;
  content: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ProjectSnapshot = {
  summary: string;
  messageHistory: Message[];
  files: ProjectFile[];
  updatedAt: string;
  previewUrl: string;
};
