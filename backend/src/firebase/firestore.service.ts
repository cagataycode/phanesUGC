import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Env } from '../config/env';

@Injectable()
export class FirestoreService implements OnModuleInit {
  private db: admin.firestore.Firestore;

  constructor(private configService: ConfigService<Env>) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    this.db = admin.firestore();
    this.db.settings({ ignoreUndefinedProperties: true });
  }

  getFirestore(): admin.firestore.Firestore {
    return this.db;
  }

  collection(path: string) {
    return this.db.collection(path);
  }

  doc(path: string) {
    return this.db.doc(path);
  }

  async set(
    path: string,
    data: admin.firestore.PartialWithFieldValue<admin.firestore.DocumentData>,
  ) {
    return this.db.doc(path).set(
      {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  async add(
    collectionPath: string,
    data: admin.firestore.WithFieldValue<admin.firestore.DocumentData>,
  ) {
    return this.db.collection(collectionPath).add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async update(
    path: string,
    data: admin.firestore.UpdateData<admin.firestore.DocumentData>,
  ) {
    return this.db.doc(path).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async queryCollectionGroup(
    collectionId: string,
    filters: Array<{
      field: string;
      operator: admin.firestore.WhereFilterOp;
      value: unknown;
    }>,
    limit?: number,
  ): Promise<admin.firestore.DocumentData[]> {
    let query: admin.firestore.Query = this.db.collectionGroup(collectionId);

    // Apply filters
    for (const filter of filters) {
      query = query.where(filter.field, filter.operator, filter.value);
    }

    // Apply limit if specified
    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
