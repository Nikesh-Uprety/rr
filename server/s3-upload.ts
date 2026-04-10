import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

export class S3Uploader {
  private readonly config: S3Config;
  private readonly client: S3Client;

  constructor(config: S3Config) {
    this.config = config;
    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string = "application/octet-stream",
  ): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: fileName,
          Body: file,
          ContentType: contentType,
        }),
      );
      return this.getPublicUrl(fileName);
    } catch (error) {
      console.error("S3 upload error:", error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: fileName,
        }),
      );
    } catch (error) {
      console.error("S3 delete error:", error);
      throw error;
    }
  }

  getPublicUrl(fileName: string): string {
    return buildPublicObjectUrl(this.config, fileName);
  }
}

function readFirst(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function isTigrisEndpoint(endpoint: string): boolean {
  return /(?:^https?:\/\/)?(?:[^/]+\.)?(?:t3\.storageapi\.dev|fly\.storage\.tigris\.dev)/i.test(endpoint);
}

function normalizeObjectKey(fileName: string): string {
  return trimLeadingSlashes(fileName).replace(/\/{2,}/g, "/");
}

export function resolvePublicObjectBaseUrl(config: S3Config): string {
  if (config.publicBaseUrl && config.publicBaseUrl.trim()) {
    return trimTrailingSlashes(config.publicBaseUrl.trim());
  }

  if (isTigrisEndpoint(config.endpoint)) {
    return `https://${config.bucket}.t3.tigrisfiles.io`;
  }

  return `${trimTrailingSlashes(config.endpoint)}/${trimLeadingSlashes(config.bucket)}`;
}

export function buildPublicObjectUrl(config: S3Config, fileName: string): string {
  const base = resolvePublicObjectBaseUrl(config);
  const key = normalizeObjectKey(fileName);
  return `${base}/${key}`;
}

export function normalizeStoredObjectUrl(url: string, config: S3Config): string {
  const rawUrl = url.trim();
  if (!rawUrl) return url;

  const normalizedBucket = trimLeadingSlashes(config.bucket);
  const publicBase = resolvePublicObjectBaseUrl(config);
  const endpointBase = trimTrailingSlashes(config.endpoint);

  const prefixes = [
    `${publicBase}/${normalizedBucket}/`,
    `${publicBase}/`,
    `${endpointBase}/${normalizedBucket}/`,
  ];

  for (const prefix of prefixes) {
    if (rawUrl.startsWith(prefix)) {
      const key = rawUrl.slice(prefix.length);
      return buildPublicObjectUrl(config, key);
    }
  }

  return url;
}

export function tryNormalizeStoredObjectUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;

  try {
    return normalizeStoredObjectUrl(url, resolveS3ConfigFromEnv());
  } catch {
    return url;
  }
}

export function resolveS3ConfigFromEnv(): S3Config {
  const publicBaseUrl =
    readFirst(
      process.env.TIGRIS_STORAGE_PUBLIC_URL,
      process.env.TIGRIS_PUBLIC_BASE_URL,
      process.env.S3_PUBLIC_BASE_URL,
      process.env.AWS_S3_PUBLIC_URL,
    );

  const endpoint =
    readFirst(
      process.env.TIGRIS_STORAGE_ENDPOINT,
      process.env.TIGRIS_ENDPOINT,
      process.env.S3_ENDPOINT,
      process.env.AWS_ENDPOINT_URL_S3,
      process.env.AWS_ENDPOINT_URL,
    ) ?? "https://t3.storageapi.dev";

  const region =
    readFirst(
      process.env.TIGRIS_STORAGE_REGION,
      process.env.TIGRIS_REGION,
      process.env.S3_REGION,
      process.env.AWS_REGION,
    ) ?? "auto";

  const bucket =
    readFirst(
      process.env.TIGRIS_STORAGE_BUCKET,
      process.env.TIGRIS_STORAGE_BUCKET_NAME,
      process.env.TIGRIS_BUCKET,
      process.env.TIGRIS_BUCKET_NAME,
      process.env.S3_BUCKET,
      process.env.AWS_S3_BUCKET,
      process.env.AWS_BUCKET,
    ) ?? "";

  const accessKeyId =
    readFirst(
      process.env.TIGRIS_STORAGE_ACCESS_KEY_ID,
      process.env.TIGRIS_ACCESS_KEY_ID,
      process.env.S3_ACCESS_KEY_ID,
      process.env.AWS_ACCESS_KEY_ID,
    ) ?? "";

  const secretAccessKey =
    readFirst(
      process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
      process.env.TIGRIS_SECRET_ACCESS_KEY,
      process.env.S3_SECRET_ACCESS_KEY,
      process.env.AWS_SECRET_ACCESS_KEY,
    ) ?? "";

  const config: S3Config = {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };

  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error("Missing S3 configuration. Please check TIGRIS_STORAGE_ / TIGRIS_ / S3_ / AWS_ environment variables.");
  }

  return config;
}

export function createS3Uploader(): S3Uploader {
  return new S3Uploader(resolveS3ConfigFromEnv());
}
