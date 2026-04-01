import crypto from 'crypto';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3Uploader {
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  private getSignature(method: string, path: string, expires: number): string {
    const stringToSign = `${method}\n\n\n\nx-amz-date:${new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')}\n${path}`;
    return crypto
      .createHmac('sha256', this.config.secretAccessKey)
      .update(stringToSign)
      .digest('base64');
  }

  private getHeaders(method: string, path: string, contentType?: string): Record<string, string> {
    const date = new Date().toISOString();
    const signature = this.getSignature(method, path, Date.now() + 3600000);
    
    return {
      'Host': `${this.config.bucket}.${this.config.endpoint.replace('https://', '')}`,
      'X-Amz-Date': date,
      'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${date.substr(0, 8)}/${this.config.region}/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`,
      ...(contentType && { 'Content-Type': contentType }),
    };
  }

  async uploadFile(file: Buffer, fileName: string, contentType: string = 'application/octet-stream'): Promise<string> {
    const path = `/${fileName}`;
    const url = `${this.config.endpoint}/${this.config.bucket}${path}`;
    
    const headers = this.getHeaders('PUT', path, contentType);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return `${this.config.endpoint}/${this.config.bucket}/${fileName}`;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    const path = `/${fileName}`;
    const url = `${this.config.endpoint}/${this.config.bucket}${path}`;
    
    const headers = this.getHeaders('DELETE', path);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('S3 delete error:', error);
      throw error;
    }
  }

  getPublicUrl(fileName: string): string {
    return `${this.config.endpoint}/${this.config.bucket}/${fileName}`;
  }
}

export function createS3Uploader(): S3Uploader {
  const config: S3Config = {
    endpoint: process.env.S3_ENDPOINT || 'https://t3.storageapi.dev',
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  };

  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error('Missing S3 configuration. Please check environment variables.');
  }

  return new S3Uploader(config);
}
