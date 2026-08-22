export function getMainRepoPath(workspaceDir: string) {
  return `${workspaceDir}/main-repo`;
}

export function getMessageToAgentQueueName(conversationId: string) {
  return `convo-request-${conversationId}`;
}

export function getLifecycleWorkerQueueName() {
  return "convo-lifecycle-worker";
}

export function getConversationHeartbeatName() {
  return "conversation:activity";
}
