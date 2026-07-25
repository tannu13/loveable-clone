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
}): Promise<TRunnerResponse<TRunnerLogsResponse>> {
  await sleep(delayMs);

  try {
    return await appRunnerClient.logs({ limit });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : errorMessage,
      status: 400,
      body: null,
    };
  }
}
