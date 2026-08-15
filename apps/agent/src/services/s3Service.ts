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

const isDev = env.NODE_ENV === "development";
const BACKUP_FILE_NAME = `chat-backup-${env.CONVERSATION_ID}-latest.json`;
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

  uploadToS3 = async (payload: any, destinationFileName: string) => {
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
        Bucket: env.AWS_CHAT_BUCKET_NAME,
        Key: destinationFileName,
        Body: jsonString,
        ContentType: "application/json",
      };

      console.log(`uploading ${destinationFileName} to S3...`);

      const command = new PutObjectCommand(uploadParams);
      const response = await this.client.send(command);

      // this way reading wud be always abt the latest file
      const copyCommand = new CopyObjectCommand({
        Bucket: env.AWS_CHAT_BUCKET_NAME,
        CopySource: `${env.AWS_CHAT_BUCKET_NAME}/${destinationFileName}`,
        Key: BACKUP_FILE_NAME,
      });
      await this.client.send(copyCommand);

      console.log("uploaded", response);
      return response;
    } catch (error) {
      console.error("error uploading:", error);
    }
  };

  async loadBackupFromS3() {
    const params = {
      Bucket: env.AWS_CHAT_BUCKET_NAME,
      Key: BACKUP_FILE_NAME,
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
export type TUploadToS3 = S3Service["uploadToS3"];
