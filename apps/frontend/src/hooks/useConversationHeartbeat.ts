import { useEffect } from "react";
import { sendHeartbeat } from "../api/conversations";

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Pings the backend every ~30s to let it know a user is actively viewing
 * this conversation. Stops automatically when the conversation changes,
 * the user navigates away, or the component unmounts.
 */
export function useConversationHeartbeat(conversationId?: string) {
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    void sendHeartbeat(conversationId);

    const intervalId = setInterval(() => {
      void sendHeartbeat(conversationId);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [conversationId]);
}
