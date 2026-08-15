import type { ConversationStreamFrameType } from "@repo/shared";

export type ConversationStreamFrame = {
  conversationId: string;
  type: ConversationStreamFrameType;
  payload: unknown;
};

type ConversationSocketListener = {
  onMessage: (frame: ConversationStreamFrame) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
};

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

function getConversationWebSocketUrl(conversationId: string): string {
  const configuredUrl = import.meta.env.VITE_CONVERSATION_WS_URL as
    | string
    | undefined;
  const baseUrl =
    configuredUrl ??
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${
      window.location.hostname
    }:3010`;
  const url = new URL(baseUrl);

  url.searchParams.set("conversation_id", conversationId);

  return url.toString();
}

function parseFrame(data: unknown): ConversationStreamFrame | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as Partial<ConversationStreamFrame>;

    if (
      typeof parsed.conversationId !== "string" ||
      typeof parsed.type !== "string" ||
      !("payload" in parsed)
    ) {
      return null;
    }

    return parsed as ConversationStreamFrame;
  } catch {
    return null;
  }
}

/**
 * Owns a single WebSocket connection for the active conversation.
 *
 * `connect` is idempotent for an already-connected/connecting conversation,
 * so callers (e.g. one per sent message) can call it freely without opening
 * duplicate sockets. A connection that drops unexpectedly reconnects itself
 * with backoff; callers never need to retry manually.
 */
class ConversationSocketClient {
  private ws: WebSocket | null = null;
  private conversationId: string | null = null;
  private readonly listeners = new Set<ConversationSocketListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;

  connect(conversationId: string) {
    if (!conversationId) {
      return;
    }

    const isAlreadyConnectedOrConnecting =
      this.conversationId === conversationId &&
      this.ws !== null &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING);

    if (isAlreadyConnectedOrConnecting) {
      return;
    }

    this.teardownSocket();
    this.conversationId = conversationId;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  subscribe(listener: ConversationSocketListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect() {
    this.intentionalClose = true;
    this.conversationId = null;
    this.teardownSocket();
  }

  private openSocket() {
    if (!this.conversationId) {
      return;
    }

    const socket = new WebSocket(
      getConversationWebSocketUrl(this.conversationId),
    );
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.listeners.forEach((listener) => listener.onOpen?.());
    };

    socket.onmessage = (event) => {
      const frame = parseFrame(event.data as unknown);

      if (!frame) {
        return;
      }

      this.listeners.forEach((listener) => listener.onMessage(frame));
    };

    socket.onerror = (event) => {
      this.listeners.forEach((listener) => listener.onError?.(event));
    };

    socket.onclose = () => {
      this.listeners.forEach((listener) => listener.onClose?.());
      this.ws = null;

      if (!this.intentionalClose && this.conversationId) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.conversationId && !this.intentionalClose) {
        this.openSocket();
      }
    }, delay);
  }

  private teardownSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

export const conversationSocketClient = new ConversationSocketClient();
