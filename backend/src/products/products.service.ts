import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../firebase/firestore.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  benefits?: string[];
  urls?: string[];
  brandAssets?: {
    storageKey: string;
    type: 'image' | 'video' | 'logo';
    filename: string;
  }[];
  defaults?: {
    tone?: string;
    targetAudience?: string;
    language?: string;
    cta?: string;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  deletedAt?: admin.firestore.Timestamp;
}

@Injectable()
export class ProductsService {
  constructor(private readonly firestore: FirestoreService) {}

  private collectionPath(businessId: string): string {
    return `businesses/${businessId}/products`;
  }

  private docPath(businessId: string, productId: string): string {
    return `businesses/${businessId}/products/${productId}`;
  }

  async create(
    businessId: string,
    createdBy: string,
    dto: CreateProductDto,
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

  async findAll(businessId: string): Promise<Product[]> {
    const snap = await this.firestore
      .collection(this.collectionPath(businessId))
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product);
  }

  async findOne(businessId: string, productId: string): Promise<Product> {
    const doc = await this.firestore
      .doc(this.docPath(businessId, productId))
      .get();

    if (!doc.exists) {
      throw new NotFoundException(
        `Product ${productId} not found in business ${businessId}`,
      );
    }

    const data = doc.data()!;
    if (data['deletedAt']) {
      throw new NotFoundException(
        `Product ${productId} not found in business ${businessId}`,
      );
    }

    return { id: doc.id, ...data } as Product;
  }

  async update(
    businessId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<void> {
    await this.findOne(businessId, productId);
    await this.firestore.doc(this.docPath(businessId, productId)).update({
      ...dto,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async softDelete(businessId: string, productId: string): Promise<void> {
    await this.findOne(businessId, productId);
    await this.firestore.doc(this.docPath(businessId, productId)).update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
