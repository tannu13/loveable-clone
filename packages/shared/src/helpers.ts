export function getMainRepoPath(workspaceDir: string) {
  return `${workspaceDir}/main-repo`;
}

export function getMessageToAgentQueueName(conversationId: string) {
  return `convo-request-${conversationId}`;
}
