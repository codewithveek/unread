import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage } from "./storage";

export interface S3StorageOptions {
  bucket: string;
  region: string;
  /** Set for S3-compatible stores such as Cloudflare R2. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createS3Storage(options: S3StorageOptions): Storage {
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: Boolean(options.endpoint),
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
  });
  const Bucket = options.bucket;
  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return result.Body ? await result.Body.transformToByteArray() : null;
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async deletePrefix(prefix) {
      let deleted = 0;
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }),
        );
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }));
          deleted += keys.length;
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return deleted;
    },
    async signedUrl(key, expiresInSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: expiresInSeconds });
    },
  };
}
