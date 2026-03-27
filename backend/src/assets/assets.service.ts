import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GcsStorageService } from '../storage/gcs-storage.service';
import type { CreateUploadUrlDto } from './dto/create-upload-url.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly gcsStorageService: GcsStorageService) {}

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  buildObjectPath(
    businessId: string,
    entityType: 'product' | 'avatar',
    entityId: string,
    dto: CreateUploadUrlDto,
  ): string {
    const safeFilename = this.sanitizeFilename(dto.filename);
    const uniqueName = `${Date.now()}-${randomUUID()}-${safeFilename}`;

    if (entityType === 'product') {
      return `businesses/${businessId}/products/${entityId}/assets/${uniqueName}`;
    }

    const section =
      dto.role === 'profile'
        ? 'profile'
        : dto.role === 'voice_sample'
          ? 'voice'
          : dto.role === 'demo'
            ? 'demo'
            : 'references';

    return `businesses/${businessId}/avatars/${entityId}/${section}/${uniqueName}`;
  }

  async createUploadUrl(
    businessId: string,
    entityId: string,
    dto: CreateUploadUrlDto,
  ) {
    const objectPath = this.buildObjectPath(
      businessId,
      dto.entityType,
      entityId,
      dto,
    );

    const upload = await this.gcsStorageService.createSignedUploadUrl(
      objectPath,
      dto.contentType,
    );

    return {
      ...upload,
      objectPath,
      asset: {
        storageKey: objectPath,
        type: dto.assetType,
        filename: dto.filename,
        role: dto.role,
      },
    };
  }
}
