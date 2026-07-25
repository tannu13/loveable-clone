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

type SupportedLibrary = "react" | "vue";

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
    return await appRunnerClient.logs({ limit: 100 });
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(
        error,
        "Failed to fetch runner logs after dev server start",
      ),
      status: 400,
      body: null,
    } satisfies TRunnerResponse<TRunnerLogsResponse>;
  }
}

export async function startBuildingApp(library: SupportedLibrary) {
  const templateName = `${library}-starter-template.zip`;
  const workspaceDirectory =
    await s3Service.downloadTemplateFromS3(templateName);

  if (!workspaceDirectory) {
    return {
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "template_download",
      template: templateMetadata({ templateName, downloaded: false }),
    };
  }

  const template = templateMetadata({
    templateName,
    downloaded: true,
    workspaceDirectory,
  });

  try {
    await validateStarterTemplate(workspaceDirectory);
  } catch (error) {
    return {
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "template_validation",
      template,
      error: errorMessage(error, "Starter template validation failed"),
    };
  }

  let install: TRunnerResponse<TRunnerInstallResponse>;
  try {
    install = await appRunnerClient.install();
  } catch (error) {
    return {
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "runner_install",
      template,
      error: errorMessage(error, "Failed to call app runner install endpoint"),
    };
  }

  if (!install.ok || install.body?.status !== "completed") {
    return {
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "install",
      template,
      install,
    };
  }

  let devServer: TRunnerResponse<TRunnerStartResponse>;
  try {
    devServer = await appRunnerClient.start();
  } catch (error) {
    return {
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "runner_start",
      template,
      install,
      error: errorMessage(error, "Failed to call app runner start endpoint"),
    };
  }

  if (!devServer.ok) {
    return {
      selectedLibrary: library,
      setupComplete: false,
      failedStep: "dev_server_start",
      template,
      install,
      devServer,
    };
  }

  return {
    selectedLibrary: library,
    template,
    install,
    devServer,
    runnerLogs: await fetchRunnerLogsAfterStart(),
    setupComplete: true,
  };
}
