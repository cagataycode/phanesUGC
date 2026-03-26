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

  async importGeneratedVideo(
    sourceUrl: string,
    objectPath: string,
  ): Promise<string> {
    if (sourceUrl.startsWith('gs://')) {
      const { bucketName, objectPath: sourceObjectPath } =
        this.parseGcsUri(sourceUrl);

      if (bucketName === this.bucketName && sourceObjectPath === objectPath) {
        return objectPath;
      }

      await this.storage
        .bucket(bucketName)
        .file(sourceObjectPath)
        .copy(this.storage.bucket(this.bucketName).file(objectPath));

      return objectPath;
    }

    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download generated video from source URL: ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    const file = this.storage.bucket(this.bucketName).file(objectPath);

    await file.save(Buffer.from(arrayBuffer), {
      resumable: false,
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    });

    return objectPath;
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
