import {
  appRunnerClient,
  type TRunnerLogsResponse,
  type TRunnerResponse,
} from "../appRunnerClient";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchRunnerLogsAfterDelay({
  delayMs,
  limit,
  errorMessage,
}: {
  delayMs: number;
  limit: number;
  errorMessage: string;
}): Promise<
  TRunnerResponse<TRunnerLogsResponse> & { logFetchFailed: boolean }
> {
  await sleep(delayMs);

  try {
    const runnerLogs = await appRunnerClient.logs({ limit });
    return {
      ...runnerLogs,
      logFetchFailed: !runnerLogs.ok,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : errorMessage,
      statusCode: 0,
      body: null,
      logFetchFailed: true,
    };
  }
}
