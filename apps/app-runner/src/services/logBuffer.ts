export type RunnerLog = {
  id: number;
  source: "dev" | "install" | "package";
  stream: "stdout" | "stderr" | "system";
  text: string;
  timestamp: string;
};

const MAX_LOGS = 500;

class LogBuffer {
  private logs: RunnerLog[] = [];
  private nextId = 1;

  append(
    source: RunnerLog["source"],
    stream: RunnerLog["stream"],
    text: string,
  ) {
    const entry = {
      id: this.nextId++,
      source,
      stream,
      text,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_LOGS);
    }

    return entry;
  }

  list({ since = 0, limit = 100 }: { since?: number; limit?: number }) {
    return this.logs.filter((log) => log.id > since).slice(-limit);
  }
}

export const logs = new LogBuffer();
