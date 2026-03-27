import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../firebase/firestore.service';
import type { CreateAvatarDto } from './dto/create-avatar.dto';
import type { UpdateAvatarDto } from './dto/update-avatar.dto';

export interface Avatar {
  id: string;
  businessId: string;
  createdBy: string;
  name: string;
  description?: string;
  type: 'ugc_creator' | 'brand_rep' | 'voice_only';
  gender?: string;
  ageRange?: string;
  locale?: string;
  appearance?: {
    hair?: string;
    outfit?: string;
    style?: string;
  };
  voiceProfile?: {
    voiceId?: string;
    provider?: string;
    language?: string;
  };
  persona?: {
    tone?: string;
    targetAudience?: string;
    ctaStyle?: string;
  };
  assets?: {
    storageKey: string;
    type: 'image' | 'video' | 'audio';
    filename: string;
    role?: 'profile' | 'reference' | 'demo' | 'voice_sample';
  }[];
  thumbnailStorageKey?: string;
  isDefault?: boolean;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  deletedAt?: admin.firestore.Timestamp | null;
}

@Injectable()
export class AvatarsService {
  constructor(private readonly firestore: FirestoreService) {}

  private collectionPath(businessId: string): string {
    return `businesses/${businessId}/avatars`;
  }

  private docPath(businessId: string, avatarId: string): string {
    return `businesses/${businessId}/avatars/${avatarId}`;
  }

  async create(
    businessId: string,
    createdBy: string,
    dto: CreateAvatarDto,
  ): Promise<string> {
    const docRef = await this.firestore
      .collection(this.collectionPath(businessId))
      .add({
        ...dto,
        businessId,
        createdBy,
        deletedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return docRef.id;
  }

  async findAll(businessId: string): Promise<Avatar[]> {
    const snap = await this.firestore
      .collection(this.collectionPath(businessId))
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Avatar);
  }

  async findOne(businessId: string, avatarId: string): Promise<Avatar> {
    const doc = await this.firestore
      .doc(this.docPath(businessId, avatarId))
      .get();

    if (!doc.exists) {
      throw new NotFoundException(
        `Avatar ${avatarId} not found in business ${businessId}`,
      );
    }

    const data = doc.data()!;
    if (data['deletedAt']) {
      throw new NotFoundException(
        `Avatar ${avatarId} not found in business ${businessId}`,
      );
    }

    return { id: doc.id, ...data } as Avatar;
  }

  async update(
    businessId: string,
    avatarId: string,
    dto: UpdateAvatarDto,
  ): Promise<void> {
    await this.findOne(businessId, avatarId);
    await this.firestore.doc(this.docPath(businessId, avatarId)).update({
      ...dto,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async softDelete(businessId: string, avatarId: string): Promise<void> {
    await this.findOne(businessId, avatarId);
    await this.firestore.doc(this.docPath(businessId, avatarId)).update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
