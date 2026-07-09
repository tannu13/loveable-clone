import type { Request, Response } from "express";
import type { TConversationSchema } from "../types/validations";
import { saveConversation, saveMessage } from "../models/conversation";
import type { RedisClientType } from "redis";
import { createNodeRedisClient, Queue } from "bullmq";

export const createControllers = ({ redis }: { redis: RedisClientType }) => {
  const converse = async (req: Request, res: Response) => {
    const { message } = req.body as TConversationSchema;
    const payload = {
      content: message,
      role: "user",
      type: "text",
    } as const;
    const conversationId = req.params.id
      ? await saveMessage(req.params.id as string, payload)
      : await saveConversation(payload);

    // create job for this and push it to another process via bullmq
    const connection = createNodeRedisClient(redis as any);
    const convoQ = new Queue(`convo-${conversationId}`, { connection });
    convoQ.add("user-message", {
      conversationId,
      message,
    });

    // td::spin up a pod in k8 cluster with an agent worker (who listens to this job) and project app

    return res.status(200).json({ conversationId });
  };

  const streamMessages = async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  };

  return { converse, streamMessages };
};
export type TControllers = ReturnType<typeof createControllers>;
