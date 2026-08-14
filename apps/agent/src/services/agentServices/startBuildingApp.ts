import { access } from "node:fs/promises";
import path from "node:path";
import {
  appRunnerClient,
  type TRunnerInstallResponse,
  type TRunnerLogsResponse,
  type TRunnerResponse,
  type TRunnerStartResponse,
} from "../appRunnerClient";
import { s3Service } from "../s3Service";
import { toggleConversationAppFlag } from "../../models/dbWriter";

type SupportedLibrary = "react" | "vue";
type FailedStep =
  | "template_download"
  | "template_validation"
  | "runner_install_unreachable"
  | "install_failed"
  | "runner_start_unreachable"
  | "dev_server_start_failed";

const RUNNER_LOG_LIMIT = 100;

async function validateStarterTemplate(workspaceDirectory: string) {
  const packageJsonPath = path.join(workspaceDirectory, "package.json");
  await access(packageJsonPath);
}

function templateMetadata({
  templateName,
  downloaded,
  workspaceDirectory,
}: {
  templateName: string;
  downloaded: boolean;
  workspaceDirectory?: string;
}) {
  return {
    name: templateName,
    downloaded,
    ...(workspaceDirectory ? { path: workspaceDirectory } : {}),
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function fetchRunnerLogsAfterStart() {
  try {
    const runnerLogs = await appRunnerClient.logs({ limit: RUNNER_LOG_LIMIT });
    return {
      ...runnerLogs,
      logFetchFailed: !runnerLogs.ok,
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(
        error,
        "Failed to fetch runner logs after dev server start",
      ),
      statusCode: 0,
      body: null,
      logFetchFailed: true,
    } satisfies TRunnerResponse<TRunnerLogsResponse> & {
      logFetchFailed: boolean;
    };
  }
}

function buildResponse({
  selectedLibrary,
  setupComplete,
  failedStep = null,
  template = null,
  install = null,
  devServer = null,
  runnerLogs = null,
  preview = null,
  error = null,
}: {
  selectedLibrary: SupportedLibrary;
  setupComplete: boolean;
  failedStep?: FailedStep | null;
  template?: Record<string, unknown> | null;
  install?: TRunnerResponse<TRunnerInstallResponse> | null;
  devServer?: TRunnerResponse<TRunnerStartResponse> | null;
  runnerLogs?:
    | (TRunnerResponse<TRunnerLogsResponse> & { logFetchFailed?: boolean })
    | null;
  preview?: { previewReady: boolean; host?: string; port?: number } | null;
  error?: string | null;
}) {
  return {
    selectedLibrary,
    setupComplete,
    failedStep,
    template,
    install,
    devServer,
    runnerLogs,
    preview,
    error,
  };
}

/**
 * main responsibilities
 * - Update the conversations table's flag `hasStartedBuildingApp`: true
 * - Download template.
 * - Run bun install.
 * - Call runner POST /start.
 * - Fetch runner status/logs.
 * - Return everything useful to the LLM.
 */
export async function startBuildingApp(library: SupportedLibrary) {
  await toggleConversationAppFlag();

  const templateName = `${library}-starter-template.zip`;
  const workspaceDirectory =
    await s3Service.downloadTemplateFromS3(templateName);

  if (!workspaceDirectory) {
    return buildResponse({
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "template_download",
      template: templateMetadata({ templateName, downloaded: false }),
      error: "Starter template could not be downloaded",
    });
  }

  const template = templateMetadata({
    templateName,
    downloaded: true,
    workspaceDirectory,
  });

  try {
    await validateStarterTemplate(workspaceDirectory);
  } catch (error) {
    return buildResponse({
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "template_validation",
      template,
      error: errorMessage(error, "Starter template validation failed"),
    });
  }

  let install: TRunnerResponse<TRunnerInstallResponse>;
  try {
    install = await appRunnerClient.install();
  } catch (error) {
    return buildResponse({
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "runner_install_unreachable",
      template,
      error: errorMessage(error, "Failed to call app runner install endpoint"),
      runnerLogs: await fetchRunnerLogsAfterStart(),
    });
  }

  if (!install.ok || install.body?.status !== "completed") {
    return buildResponse({
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "install_failed",
      template,
      install,
      runnerLogs: await fetchRunnerLogsAfterStart(),
      error: "App dependency install did not complete successfully",
    });
  }

  let devServer: TRunnerResponse<TRunnerStartResponse>;
  try {
    devServer = await appRunnerClient.start();
  } catch (error) {
    return buildResponse({
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "runner_start_unreachable",
      template,
      install,
      error: errorMessage(error, "Failed to call app runner start endpoint"),
      runnerLogs: await fetchRunnerLogsAfterStart(),
    });
  }

  if (!devServer.ok) {
    return buildResponse({
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "dev_server_start_failed",
      template,
      install,
      devServer,
      runnerLogs: await fetchRunnerLogsAfterStart(),
      error: "Dev server did not start successfully",
    });
  }

  return buildResponse({
    selectedLibrary: library,
    template,
    install,
    devServer,
    runnerLogs: await fetchRunnerLogsAfterStart(),
    preview: {
      previewReady: true,
      host: devServer.body?.host,
      port: devServer.body?.port,
    },
    setupComplete: true,
  });
}
