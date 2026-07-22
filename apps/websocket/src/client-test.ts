import env from "./env";

type MessagePayload = {
  conversationId: string;
  payload: unknown;
};
const ws = new WebSocket(
  `ws://localhost:${env.WS_SERVER_PORT}?conversation_id=44d2d019-526f-405d-b7ec-69fb4e5282b1`,
);
ws.onmessage = (event: MessageEvent) => {
  try {
    const message: MessagePayload = JSON.parse(event.data);
    const { conversationId, payload } = message;

    console.dir({ conversationId, payload }, { depth: 5 });
  } catch (error) {
    console.error("Failed to parse or process WebSocket message:", error);
  }
};
