import fs from "fs";
import path from "path";
import { createS3Uploader, resolveS3ConfigFromEnv, type S3Uploader } from "./s3-upload";
import { resolveUploadsDir } from "./uploads";

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StorageService {
  uploadFile(file: Buffer, fileName: string, contentType?: string): Promise<string>;
  deleteFile(fileName: string): Promise<void>;
  getPublicUrl(fileName: string): string;
}

export class LocalStorageService implements StorageService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = resolveUploadsDir();
  }

  async uploadFile(file: Buffer, fileName: string, contentType?: string): Promise<string> {
    const filePath = path.join(this.uploadsDir, fileName);
    
    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, file);
      return `/uploads/${fileName}`;
    } catch (error) {
      console.error('Local upload error:', error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, fileName);
    
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.error('Local delete error:', error);
      throw error;
    }
  }

  getPublicUrl(fileName: string): string {
    return `/uploads/${fileName}`;
  }
}

export class S3StorageService implements StorageService {
  private s3Uploader: S3Uploader;
  private config: StorageConfig;

  constructor() {
    this.config = this.getStorageConfig();
    this.s3Uploader = createS3Uploader();
  }

  private getStorageConfig(): StorageConfig {
    const resolved = resolveS3ConfigFromEnv();
    return {
      endpoint: resolved.endpoint,
      region: resolved.region,
      bucket: resolved.bucket,
      accessKeyId: resolved.accessKeyId,
      secretAccessKey: resolved.secretAccessKey,
    };
  }

  async uploadFile(file: Buffer, fileName: string, contentType?: string): Promise<string> {
    try {
      await this.s3Uploader.uploadFile(file, fileName, contentType);
      return this.s3Uploader.getPublicUrl(fileName);
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.s3Uploader.deleteFile(fileName);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw error;
    }
  }

  getPublicUrl(fileName: string): string {
    return this.s3Uploader.getPublicUrl(fileName);
  }
}

export function createStorageService(): StorageService {
  try {
    const config = resolveS3ConfigFromEnv();
    const isTigrisEndpoint = config.endpoint.toLowerCase().includes("tigris");
    console.log(isTigrisEndpoint ? "🐅 Using Tigris object storage" : "🗂️ Using S3-compatible object storage");
    return new S3StorageService();
  } catch {
    console.log("💾 Using local file storage");
    return new LocalStorageService();
  }
}

export const storageService = createStorageService();
