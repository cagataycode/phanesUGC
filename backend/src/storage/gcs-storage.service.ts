import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { readFile } from 'node:fs/promises';
import { Env } from '../config/env';

@Injectable()
export class GcsStorageService {
  private readonly storage: Storage;
  private readonly bucketName: string;

  private parseGcsUri(uri: string): { bucketName: string; objectPath: string } {
    if (!uri.startsWith('gs://')) {
      throw new Error(`Unsupported GCS URI: ${uri}`);
    }

    const withoutScheme = uri.slice('gs://'.length);
    const firstSlash = withoutScheme.indexOf('/');

    if (firstSlash === -1) {
      throw new Error(`Invalid GCS URI missing object path: ${uri}`);
    }

    return {
      bucketName: withoutScheme.slice(0, firstSlash),
      objectPath: withoutScheme.slice(firstSlash + 1),
    };
  }

  constructor(private readonly configService: ConfigService<Env>) {
    this.bucketName = this.configService.get('GCS_BUCKET_NAME', {
      infer: true,
    })!;
    const projectId = this.configService.get('FIREBASE_PROJECT_ID', {
      infer: true,
    })!;
    const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL', {
      infer: true,
    })!;
    const privateKey = this.configService
      .get('FIREBASE_PRIVATE_KEY', { infer: true })!
      .replace(/\\n/g, '\n');

    this.storage = new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
  }

  async createSignedVideoUrl(objectPath: string): Promise<string> {
    const [signedUrl] = await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 15,
        version: 'v4',
      });

    return signedUrl;
  }

  async createSignedDownloadUrl(objectPath: string): Promise<string> {
    const [signedUrl] = await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60, // 1 hour
        version: 'v4',
      });

    return signedUrl;
  }

  async createSignedUploadUrl(
    objectPath: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; method: 'PUT' }> {
    const [uploadUrl] = await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .getSignedUrl({
        action: 'write',
        expires: Date.now() + 1000 * 60 * 15,
        version: 'v4',
        contentType,
      });

    return { uploadUrl, method: 'PUT' };
  }

  async importGeneratedVideo(
    sourceUrl: string,
    objectPath: string,
  ): Promise<{ path: string; sizeBytes: number }> {
    if (sourceUrl.startsWith('gs://')) {
      const { bucketName, objectPath: sourceObjectPath } =
        this.parseGcsUri(sourceUrl);

      if (bucketName === this.bucketName && sourceObjectPath === objectPath) {
        // Get file size
        const [metadata] = await this.storage
          .bucket(this.bucketName)
          .file(objectPath)
          .getMetadata();
        return { path: objectPath, sizeBytes: Number(metadata.size) || 0 };
      }

      await this.storage
        .bucket(bucketName)
        .file(sourceObjectPath)
        .copy(this.storage.bucket(this.bucketName).file(objectPath));

      // Get file size after copy
      const [metadata] = await this.storage
        .bucket(this.bucketName)
        .file(objectPath)
        .getMetadata();
      return { path: objectPath, sizeBytes: Number(metadata.size) || 0 };
    }

    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download generated video from source URL: ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const sizeBytes = arrayBuffer.byteLength;

    const file = this.storage.bucket(this.bucketName).file(objectPath);

    await file.save(Buffer.from(arrayBuffer), {
      resumable: false,
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    });

    return { path: objectPath, sizeBytes };
  }

  async importAssetFromUrl(
    sourceUrl: string,
    objectPath: string,
  ): Promise<string> {
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download asset from source URL: ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    const file = this.storage.bucket(this.bucketName).file(objectPath);

    await file.save(Buffer.from(arrayBuffer), {
      resumable: false,
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
    });

    return objectPath;
  }

  async downloadFile(
    objectPath: string,
    destinationLocalPath: string,
  ): Promise<void> {
    await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .download({ destination: destinationLocalPath });
  }

  async uploadLocalFile(
    localFilePath: string,
    objectPath: string,
    contentType = 'video/mp4',
  ): Promise<string> {
    const fileBuffer = await readFile(localFilePath);

    await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .save(fileBuffer, {
        resumable: false,
        contentType,
      });

    return objectPath;
  }
}
