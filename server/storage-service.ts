import fs from "fs";
import path from "path";
import { createS3Uploader, type S3Uploader } from "./s3-upload";
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
    // Try Tigris first, fallback to t3.storageapi.dev
    if (process.env.TIGRIS_ENDPOINT && process.env.TIGRIS_BUCKET) {
      console.log('🐅 Using Tigris S3 storage');
      return {
        endpoint: process.env.TIGRIS_ENDPOINT,
        region: process.env.TIGRIS_REGION || 'auto',
        bucket: process.env.TIGRIS_BUCKET,
        accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY || '',
      };
    }

    // Fallback to t3.storageapi.dev (original setup)
    if (process.env.S3_ENDPOINT && process.env.S3_BUCKET) {
      console.log('🗂️ Using t3.storageapi.dev S3 storage');
      return {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'auto',
        bucket: process.env.S3_BUCKET,
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      };
    }

    throw new Error('No S3 storage configuration found. Please set S3_ or TIGRIS_ environment variables.');
  }

  async uploadFile(file: Buffer, fileName: string, contentType?: string): Promise<string> {
    try {
      const url = await this.s3Uploader.uploadFile(file, fileName, contentType);
      // Return URL without full endpoint for API responses
      const endpoint = this.config.endpoint.replace('https://', '').replace('.storageapi.dev', '');
      return `https://${endpoint}/${this.config.bucket}/${fileName}`;
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
    const endpoint = this.config.endpoint.replace('https://', '').replace('.storageapi.dev', '');
    return `https://${endpoint}/${this.config.bucket}/${fileName}`;
  }
}

export function createStorageService(): StorageService {
  // Use Tigris if available, fallback to t3.storageapi.dev
  if (
    process.env.TIGRIS_ENDPOINT &&
    process.env.TIGRIS_BUCKET &&
    process.env.TIGRIS_ACCESS_KEY_ID &&
    process.env.TIGRIS_SECRET_ACCESS_KEY
  ) {
    console.log('🐅 Using Tigris S3 storage');
    return new S3StorageService();
  }

  // Fallback to t3.storageapi.dev if configured
  if (
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  ) {
    console.log('🗂️ Using t3.storageapi.dev S3 storage');
    return new S3StorageService();
  }

  // Fallback to local storage
  console.log('💾 Using local file storage');
  return new LocalStorageService();
}

export const storageService = createStorageService();
