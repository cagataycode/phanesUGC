import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { Env } from '../config/env';

@Injectable()
export class GcsStorageService {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService<Env>) {
    this.bucketName = this.configService.get('GCS_BUCKET_NAME', { infer: true })!;
    const projectId = this.configService.get('FIREBASE_PROJECT_ID', { infer: true })!;
    const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY', { infer: true })!.replace(
      /\\n/g,
      '\n',
    );

    this.storage = new Storage({
      projectId,
      credentials: {
        client_email: 'firebase-adminsdk@placeholder.iam.gserviceaccount.com',
        private_key: privateKey,
      },
    });
  }

  async createSignedVideoUrl(objectPath: string): Promise<string> {
    const [signedUrl] = await this.storage.bucket(this.bucketName).file(objectPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 15,
      version: 'v4',
    });

    return signedUrl;
  }
}
