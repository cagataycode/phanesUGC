import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { DecodedIdToken } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

export interface UserProfile {
  uid: string;
  email: string;
  defaultBusinessId: string;
  createdAt:
    | string
    | admin.firestore.Timestamp
    | Date
    | admin.firestore.FieldValue;
  updatedAt:
    | string
    | admin.firestore.Timestamp
    | Date
    | admin.firestore.FieldValue;
}

@Injectable()
export class UsersService {
  constructor(private readonly firestore: FirestoreService) {}

  /**
   * Fetches an existing user or creates a new one along with a default workspace.
   */
  async getOrCreateUser(decodedToken: DecodedIdToken): Promise<UserProfile> {
    const { uid, email } = decodedToken;
    const db = this.firestore.getFirestore();
    const userRef = db.doc(`users/${uid}`);

    const userSnap = await userRef.get();

    if (userSnap.exists) {
      // User exists, return the user document
      return userSnap.data() as UserProfile;
    }

    // User does not exist, auto-provision their account and personal workspace
    const batch = db.batch();
    const bizRef = db.collection('businesses').doc();
    const memberRef = db.doc(`businesses/${bizRef.id}/members/${uid}`);

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1. Create User Document
    const userData = {
      uid,
      email: email || '',
      defaultBusinessId: bizRef.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    batch.set(userRef, userData);

    // 2. Create Business Document (Personal Workspace)
    const bizData = {
      id: bizRef.id,
      name: 'Personal Workspace',
      ownerId: uid,
      usage: {
        adsGeneratedThisMonth: 0,
        adsGeneratedTotal: 0,
        currentPeriodStart: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    batch.set(bizRef, bizData);

    // 3. Create Membership Document (Add user as owner of the new business)
    const memberData = {
      uid,
      email: email || '',
      role: 'owner',
      joinedAt: timestamp,
    };
    batch.set(memberRef, memberData);

    // Commit the batch transaction
    await batch.commit();

    // Return the newly created user data (resolving the timestamps for the response)
    return {
      uid,
      email: email || '',
      defaultBusinessId: bizRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
