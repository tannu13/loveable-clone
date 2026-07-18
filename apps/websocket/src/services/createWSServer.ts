import env from "../env";

export const createWSServer = () => {
  return Bun.serve<{
    conversationId: string;
  }>({
    port: env.WS_SERVER_PORT,
    fetch(req, server) {
      const url = new URL(req.url);
      const conversationId = url.searchParams.get("conversation_id") ?? "";

      const success = server.upgrade(req, {
        data: {
          conversationId,
        },
      });

      if (success) return undefined;
      return new Response("Upgrade failed", { status: 400 });
    },
    websocket: {
      open(ws) {
        console.log("Connected to websocket server");
        ws.subscribe(`conversation:${ws.data.conversationId}`);
      },
      message(_ws, _message) {},
    },
  });
};
