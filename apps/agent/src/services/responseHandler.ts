import type { Message } from "@repo/shared";
import type { RedisClientType } from "redis";
import env from "../env";
import type { Content } from "@google/genai";
import { getCurrentFormattedDate } from "../utils/helpers";
import type { TUploadToS3 } from "./s3Service";
import {
  cleanupWorktree,
  createDiffArtifact,
} from "../utils/git-worktree-utils";
import { saveMessageHistory } from "../models/dbWriter";

type TDB = {
  type: Message["type"];
  content: string;
  metadata?: unknown;
  role?: Message["role"];
};
export interface ResponseLifeCycle {
  send(type: Message["type"], payload: unknown): Promise<void>;
  end(data: { history: Content[]; db?: TDB }): Promise<void>;
  saveToDB(data: TDB): Promise<void>;
}

export class UserResponseHandler implements ResponseLifeCycle {
  private publisher: RedisClientType;
  private uploadToS3: TUploadToS3;

  constructor(publisher: RedisClientType, uploadToS3: TUploadToS3) {
    this.publisher = publisher;
    this.uploadToS3 = uploadToS3;
  }

  async send(type: Message["type"], payload: unknown) {
    this.publisher.publish(
      `convo-response`,
      JSON.stringify({ conversationId: env.CONVERSATION_ID, type, payload }),
    );
  }

  async end(data: { history: Content[]; db?: TDB }) {
    this.publisher.publish(
      `convo-response`,
      JSON.stringify({
        conversationId: env.CONVERSATION_ID,
        type: "text",
        payload: "[DONE]",
      }),
    );

    if (data.history.length > 0) {
      this.backupHistory(data.history);
    }

    if (data.db) {
      this.saveToDB(data.db);
    }
  }

  private async backupHistory(history: Content[]) {
    await this.uploadToS3(
      { history },
      `${getCurrentFormattedDate()}-chat-backup-${env.CONVERSATION_ID}`,
    );
  }

  async saveToDB({
    type,
    content,
    metadata,
    role = "assistant",
  }: {
    type: Message["type"];
    content: string;
    metadata?: unknown;
    role?: Message["role"];
  }) {
    await saveMessageHistory({
      type,
      content,
      metadata,
      role,
    });
  }
}

export class SubAgentResponseHandler implements ResponseLifeCycle {
  private artifactPath: string;
  private worktreePath: string;
  private mainRepoPath: string;
  private branchName: string;

  constructor(
    artifactPath: string,
    worktreePath: string,
    mainRepoPath: string,
    branchName: string,
  ) {
    this.artifactPath = artifactPath;
    this.worktreePath = worktreePath;
    this.mainRepoPath = mainRepoPath;
    this.branchName = branchName;
  }
  async saveToDB(data: TDB) {
    // tbd
    return;
  }
  async send(type: Message["type"], payload: unknown) {
    // tbd
  }

  async end() {
    // write the diff in the worktree to the artifact file path
    try {
      await createDiffArtifact(this.worktreePath, this.artifactPath);
    } finally {
      // clean up the worktree
      await cleanupWorktree(this.mainRepoPath, this.branchName);
    }
    // send the message with the artifact path
    if (!process.send) return;

    process.send({
      type: "finished",
      artifactPath: this.artifactPath,
    });
  }
}
