import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import * as unzipper from "unzipper";
import env from "../env";
import { getMainRepoPath } from "../utils/helpers";
import { PassThrough } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";
import * as tar from "tar";

const isDev = env.NODE_ENV === "development";
const CHAT_BACKUP_FILE_NAME = `chat-backup-${env.CONVERSATION_ID}-latest.json`;
const USER_APP_BACKUP_FILE_NAME = `user-app-backup-${env.CONVERSATION_ID}-latest.tar.gz`;
class S3Service {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
      endpoint: isDev ? env.MINIO_ENDPOINT : undefined,
      forcePathStyle: isDev,
    });
  }

  uploadToS3 = async (
    bucketName: string,
    payload: any,
    destinationFileName: string,
  ) => {
    try {
      const jsonString = JSON.stringify(
        payload,
        (_, value) => {
          if (value instanceof Map) {
            return { _type: "Map", data: Array.from(value.entries()) };
          }
          return value;
        },
        2,
      );

      const uploadParams = {
        Bucket: bucketName,
        Key: destinationFileName,
        Body: jsonString,
        ContentType: "application/json",
      };

      console.log(
        `uploading ${destinationFileName} to S3 bucked: ${bucketName}...`,
      );

      const command = new PutObjectCommand(uploadParams);
      const response = await this.client.send(command);

      // this way reading wud be always abt the latest fi le
      const copyCommand = new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${destinationFileName}`,
        Key: CHAT_BACKUP_FILE_NAME,
      });
      await this.client.send(copyCommand);

      console.log("uploaded", response);
      return response;
    } catch (error) {
      console.error("error uploading:", error);
    }
  };

  uploadChatBackupToS3 = async (payload: any, destinationFileName: string) => {
    return this.uploadToS3(
      env.AWS_CHAT_BUCKET_NAME,
      payload,
      destinationFileName,
    );
  };

  async uploadWorkspaceToS3(
    bucketName: string,
    workspacePath: string,
    destinationKey: string,
  ) {
    try {
      console.log(`Creating tar.gz archive from ${workspacePath}...`);

      const archiveStream = tar.c(
        {
          cwd: workspacePath,
          gzip: true,
          strict: true,
          filter: (path) => {
            return this.shouldInclude(path);
          },
        },
        ["."],
      );

      const passThrough = new PassThrough();
      archiveStream.pipe(passThrough);

      console.log(`Uploading ${destinationKey} to S3 bucket ${bucketName}...`);

      const upload = new Upload({
        client: this.client,

        params: {
          Bucket: bucketName,
          Key: destinationKey,
          Body: passThrough,
          ContentType: "application/gzip",
          ContentDisposition: `attachment; filename="${destinationKey.split("/").pop()}"`,
        },
        queueSize: 4,
        partSize: 10 * 1024 * 1024,
        leavePartsOnError: false,
      });

      upload.on("httpUploadProgress", (progress) => {
        console.log(`Upload progress: ${progress.loaded ?? 0} bytes`);
      });

      const response = await upload.done();

      console.log(`Successfully uploaded ${destinationKey}`);

      return response;
    } catch (error) {
      console.error(`Failed to backup workspace ${workspacePath}:`, error);

      throw error;
    }
  }

  private async updateLatestAppBackup(bucketName: string, sourceKey: string) {
    const parts = sourceKey.split("/");

    // conversations/<conversationId>/backups/<timestamp>.tar.gz
    const conversationId = parts[1];

    const latestKey = `conversations/${conversationId}/latest.tar.gz`;

    await this.client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${sourceKey}`,
        Key: latestKey,
      }),
    );

    console.log(`Updated ${latestKey}`);
  }

  private shouldInclude(path: string): boolean {
    const normalized = path.replaceAll("\\", "/");

    const excludedDirectories = [
      "node_modules",
      ".next",
      "dist",
      "build",
      ".cache",
      ".turbo",
      ".vite",
      ".parcel-cache",
      "coverage",
    ];

    const excludedFiles = [
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",
    ];

    // path might be:
    // ./node_modules/foo
    // node_modules/foo
    // ./src/foo.ts
    const parts = normalized.split("/");

    if (parts.some((part) => excludedDirectories.includes(part))) {
      return false;
    }

    const filename = parts.at(-1);

    if (filename && excludedFiles.includes(filename)) {
      return false;
    }

    return true;
  }

  uploadAppBackupToS3 = async (destinationFileName: string) => {
    await this.uploadWorkspaceToS3(
      env.AWS_USER_APP_BUCKET_NAME,
      getMainRepoPath(),
      destinationFileName,
    );

    await this.updateLatestAppBackup(
      env.AWS_USER_APP_BUCKET_NAME,
      destinationFileName,
    );
  };

  async loadBackupFromS3() {
    const params = {
      Bucket: env.AWS_CHAT_BUCKET_NAME,
      Key: CHAT_BACKUP_FILE_NAME,
    };

    try {
      await this.client.send(new HeadObjectCommand(params));

      const response = await this.client.send(new GetObjectCommand(params));

      if (!response.Body) {
        throw new Error("response.Body is undefined");
      }
      const streamToString = await response.Body.transformToString();

      const backup = JSON.parse(streamToString, (_, value) => {
        if (value && value._type === "Map") {
          return new Map(value.data);
        }
        return value;
      });

      console.log("store backup found and loaded.");
      return backup;
    } catch (error: any) {
      if (error?.name && error?.name === "NotFound") {
        console.log("No backup file found");
        return null;
      }

      console.error("error retrieving backup:", error);
      throw error;
    }
  }

  async downloadTemplateFromS3(templateName: string) {
    const params = {
      Bucket: env.AWS_STARTER_TEMPLATES_BUCKET_NAME,
      Key: templateName,
    };

    const outputDirectory = getMainRepoPath();

    try {
      await this.client.send(new HeadObjectCommand(params));

      const response = await this.client.send(new GetObjectCommand(params));

      if (!response.Body) {
        throw new Error("response.Body is undefined");
      }

      // unzipper.Extract() streams entries off the zip sequentially and can
      // silently stop partway through on archives with many entries (e.g.
      // our templates, which intentionally include a full .git/ directory)
      // without raising an error - the promise still resolves as if nothing
      // went wrong. Reading the whole zip into a buffer and extracting via
      // the central directory (Open.buffer) is not subject to that bug.
      const zipBytes = await response.Body.transformToByteArray();
      const directory = await unzipper.Open.buffer(Buffer.from(zipBytes));
      await directory.extract({ path: outputDirectory });

      console.log(
        `Starter template files successfully downloaded and extracted to: ${outputDirectory}`,
      );
      return outputDirectory;
    } catch (error: any) {
      if (
        error?.name === "NotFound" ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        console.log("No starter template found");
        return null;
      }

      console.error("Error retrieving or extracting starter template:", error);
      throw error;
    }
  }
}

export const s3Service = new S3Service();
export type TUploadChatBackupToS3 = S3Service["uploadChatBackupToS3"];
