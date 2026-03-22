import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: Storage;
  private readonly bucket: Bucket;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || `${projectId}-assets`;

    // Initialize Google Cloud Storage
    // In production, this would use service account credentials
    this.storage = new Storage({
      projectId,
    });

    this.bucket = this.storage.bucket(this.bucketName);
  }

  /**
   * Upload a file to Google Cloud Storage
   */
  async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    contentType: string = 'application/octet-stream',
  ): Promise<string> {
    this.logger.log(`Uploading file to ${destinationPath}`);

    try {
      const file = this.bucket.file(destinationPath);

      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`;
      this.logger.log(`File uploaded successfully: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      this.logger.error('Failed to upload file', error);
      throw error;
    }
  }

  /**
   * Download a file from Google Cloud Storage
   */
  async downloadFile(sourcePath: string): Promise<Buffer> {
    this.logger.log(`Downloading file from ${sourcePath}`);

    try {
      const file = this.bucket.file(sourcePath);
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      this.logger.error('Failed to download file', error);
      throw error;
    }
  }

  /**
   * Delete a file from Google Cloud Storage
   */
  async deleteFile(path: string): Promise<void> {
    this.logger.log(`Deleting file: ${path}`);

    try {
      const file = this.bucket.file(path);
      await file.delete();
      this.logger.log('File deleted successfully');
    } catch (error) {
      this.logger.error('Failed to delete file', error);
      throw error;
    }
  }

  /**
   * Get a signed URL for private file access
   */
  async getSignedUrl(path: string, expiresInSeconds: number = 3600): Promise<string> {
    this.logger.log(`Generating signed URL for ${path}`);

    try {
      const file = this.bucket.file(path);
      
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInSeconds * 1000,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error('Failed to generate signed URL', error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const file = this.bucket.file(path);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      this.logger.error('Failed to check file existence', error);
      return false;
    }
  }

  /**
   * Generate a unique file path
   */
  generateFilePath(userId: string, filename: string): string {
    const timestamp = Date.now();
    const extension = filename.split('.').pop();
    return `users/${userId}/${timestamp}.${extension}`;
  }

  /**
   * Generate a path for ad assets
   */
  generateAdAssetPath(adId: string, assetType: string, filename: string): string {
    return `ads/${adId}/${assetType}/${filename}`;
  }

  /**
   * Get bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }
}
