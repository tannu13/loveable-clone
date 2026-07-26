import env from "../env";

export type TRunnerResponse<T> = {
  ok: boolean;
  error?: string;
  statusCode: number;
  body: T | null;
};

export type TRunnerInstallResponse = {
  status: "completed" | "failed" | "busy";
  appDir?: string;
  operation?: unknown;
  result?: {
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    error?: string;
  };
};

export type TRunnerStartResponse = {
  status: "started" | "already_running";
  appDir?: string;
  host?: string;
  port?: number;
};

export type TRunnerLogsResponse = {
  logs: Array<{
    id: number;
    source: "dev" | "install" | "package";
    stream: "stdout" | "stderr" | "system";
    text: string;
    timestamp: string;
  }>;
};

class AppRunnerClient {
  private baseUrl: string;

  constructor(baseUrl = env.APP_RUNNER_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
    const body = (await response.json()) as T;

    return {
      ok: response.ok,
      statusCode: response.status,
      body,
    } satisfies TRunnerResponse<T>;
  }

  async install() {
    return this.request<TRunnerInstallResponse>("/install", {
      method: "POST",
    });
  }

  async start() {
    return this.request<TRunnerStartResponse>("/start", {
      method: "POST",
    });
  }

  async logs({ since = 0, limit = 100 }: { since?: number; limit?: number }) {
    return this.request<TRunnerLogsResponse>(
      `/logs?since=${since}&limit=${limit}`,
    );
  }
}

export const appRunnerClient = new AppRunnerClient();
