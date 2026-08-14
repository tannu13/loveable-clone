import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchConversationDetails,
  fetchProjectSnapshot,
  HttpError,
} from "../api/conversations";
import { fetchProjectFileContent } from "../api/projectFiles";
import { ChatPanel } from "../features/chat/ChatPanel";
import { CodeWorkspace } from "../features/workspace/CodeWorkspace";
import { PreviewWorkspace } from "../features/workspace/PreviewWorkspace";
import { useConversationStream } from "../hooks/useConversationStream";
import { getStoredIdentity, type UserIdentity } from "../lib/identity";
import { hasStoredSessionToken } from "../lib/session";
import type { ViewMode } from "../types/view";
import { LandingPage } from "./LandingPage";

export function WorkspaceRoute() {
  const { conversationId: routeConversationId } = useParams();
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(() => hasStoredSessionToken());
  const [viewMode, setViewMode] = useState<ViewMode>("code");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [identity, setIdentity] = useState<UserIdentity>(() =>
    getStoredIdentity(),
  );
  const queryClient = useQueryClient();

  const projectQuery = useQuery({
    enabled: hasSession,
    queryKey: routeConversationId
      ? ["conversation-details", routeConversationId]
      : ["project"],
    queryFn: () =>
      routeConversationId
        ? fetchConversationDetails(routeConversationId)
        : fetchProjectSnapshot(),
  });
  const conversationStream = useConversationStream(routeConversationId);

  useEffect(() => {
    if (
      routeConversationId &&
      projectQuery.error instanceof HttpError &&
      projectQuery.error.status === 404
    ) {
      navigate("/", { replace: true });
    }
  }, [navigate, projectQuery.error, routeConversationId]);

  const hasStartedBuildingApp =
    projectQuery.data !== undefined &&
    "hasStartedBuildingApp" in projectQuery.data &&
    projectQuery.data.hasStartedBuildingApp;

  const files = projectQuery.data?.files ?? [];
  const selectedFile = files.find((file) => file.path === selectedFilePath);

  useEffect(() => {
    if (
      selectedFilePath &&
      !files.some((file) => file.path === selectedFilePath)
    ) {
      setSelectedFilePath(null);
    }
  }, [files, selectedFilePath]);

  const selectedFileContentQuery = useQuery({
    enabled: hasSession && Boolean(selectedFile?.path),
    queryKey: ["project-file-content", selectedFile?.path],
    queryFn: () => fetchProjectFileContent(selectedFile!.path),
  });

  const statusLabel = (() => {
    if (conversationStream.isStreaming) {
      return "Working";
    }

    if (projectQuery.isLoading) {
      return "Loading";
    }

    if (projectQuery.isError) {
      return "Offline";
    }

    return "Synced";
  })();

  const displayedMessages = [
    ...(projectQuery.data?.messageHistory ?? []),
    ...conversationStream.streamedMessages,
  ];

  const handleSendMessage = (message: string) => {
    void conversationStream.sendMessage(message, {
      conversationId: routeConversationId,
      onConversationStarted: ({
        conversationId: startedConversationId,
        previewUrl,
        userMessage,
      }) => {
        if (routeConversationId) {
          return;
        }

        queryClient.setQueryData(
          ["conversation-details", startedConversationId],
          {
            conversationId: startedConversationId,
            files: [],
            hasStartedBuildingApp: false,
            messageHistory: [],
            previewUrl,
            summary: "Project conversation",
            updatedAt: userMessage.createdAt,
          },
        );

        navigate(`/${startedConversationId}`);
      },
    });
  };

  const handleIdentityChange = (nextIdentity: UserIdentity) => {
    setIdentity(nextIdentity);
    void projectQuery.refetch();
  };

  if (!hasSession) {
    return <LandingPage onStart={() => setHasSession(true)} />;
  }

  return (
    <main className="h-dvh overflow-hidden bg-(--app-bg) text-(--text)">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-(--border) bg-(--panel) px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--accent) text-sm font-bold text-white">
              L
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-5">
                Loveable Workspace
              </h1>
              <p className="hidden text-xs text-(--muted) sm:block">
                app-builder / live project
              </p>
            </div>
          </div>

          {hasStartedBuildingApp ? (
            <div className="grid h-9 grid-cols-2 rounded-lg border border-(--border) bg-(--control) p-1 text-sm">
              {(["code", "preview"] as const).map((mode) => (
                <button
                  className={`h-7 min-w-20 rounded-md px-3 font-medium transition ${
                    viewMode === mode
                      ? "bg-(--control-active) text-(--text) shadow-sm"
                      : "text-(--muted) hover:text-(--text)"
                  }`}
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  type="button"
                >
                  {mode === "code" ? "Code" : "Preview"}
                </button>
              ))}
            </div>
          ) : null}

          <div className="hidden items-center gap-2 text-xs text-(--muted) md:flex">
            <span className="rounded-full border border-(--border) px-2.5 py-1">
              {statusLabel}
            </span>
            <button
              className="grid size-8 place-items-center rounded-lg border border-(--border) bg-(--control) text-(--muted) transition hover:text-(--text)"
              type="button"
              aria-label="Open settings"
            >
              ...
            </button>
          </div>
        </header>

        {hasStartedBuildingApp ? (
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,42dvh)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-1">
            <section className="min-h-0 overflow-hidden p-3 sm:p-4">
              {viewMode === "code" ? (
                <CodeWorkspace
                  error={projectQuery.error}
                  files={files}
                  fileContent={selectedFileContentQuery.data}
                  fileContentError={selectedFileContentQuery.error}
                  isError={projectQuery.isError}
                  isFileContentError={selectedFileContentQuery.isError}
                  isFileContentLoading={selectedFileContentQuery.isLoading}
                  isLoading={projectQuery.isLoading}
                  onSelectFile={setSelectedFilePath}
                  selectedFile={selectedFile}
                />
              ) : (
                <PreviewWorkspace
                  isLoading={projectQuery.isLoading}
                  previewUrl={projectQuery.data?.previewUrl ?? ""}
                  reloadKey={previewReloadKey}
                />
              )}
            </section>

            <ChatPanel
              error={conversationStream.error}
              identity={identity}
              isLoading={projectQuery.isLoading}
              isStreaming={conversationStream.isStreaming}
              messages={displayedMessages}
              onIdentityChange={handleIdentityChange}
              onSendMessage={handleSendMessage}
            />
          </div>
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden">
            <ChatPanel
              error={conversationStream.error}
              identity={identity}
              isLoading={projectQuery.isLoading}
              isStreaming={conversationStream.isStreaming}
              messages={displayedMessages}
              onIdentityChange={handleIdentityChange}
              onSendMessage={handleSendMessage}
              variant="standalone"
            />
          </div>
        )}
      </div>
    </main>
  );
}
