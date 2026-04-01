import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../firebase/firestore.service';
import { CreativeBrief } from '../types/creative-brief';
import { GeneratedScript } from '../types/generated-script';
import * as admin from 'firebase-admin';

export type AdJobStatus = 'created' | 'processing' | 'completed' | 'failed';

export interface ProjectStage {
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
}

export interface AdJobMetadata {
  scenePrompt?: {
    intent: string;
    visualStyle: string;
    cameraMotion: string;
    fullPrompt?: string;
    negativePrompt?: string;
  };
  renderRequest?: {
    fps: number;
    durationInFrames: number;
    phraseCount: number;
  };
  subtitleScaling?: {
    plannedDurationSec: number;
    actualDurationSec: number;
    scalingFactor: number;
  };
  simulatedScenes?: Array<{
    narration: string;
    duration_sec: number;
  }>;
}

export interface AdJob {
  id: string;
  businessId: string;
  productId: string;
  createdBy: string;
  prompt: string;
  platform: string;
  aspectRatio: string;
  durationSec: number;
  status: AdJobStatus;
  progress: number;
  stages: {
    scrape: AdJobStatus | 'pending' | 'running' | 'done' | 'skipped';
    brief: AdJobStatus | 'pending' | 'running' | 'done';
    script: AdJobStatus | 'pending' | 'running' | 'done';
    scenes: AdJobStatus | 'pending' | 'running' | 'done';
    assets: AdJobStatus | 'pending' | 'running' | 'done';
    audio: AdJobStatus | 'pending' | 'running' | 'done';
    subtitles: AdJobStatus | 'pending' | 'running' | 'done';
    render: AdJobStatus | 'pending' | 'running' | 'done';
  };
  creativeBrief?: CreativeBrief;
  script?: GeneratedScript;
  metadata?: AdJobMetadata;
  subtitleSegments?: Array<{
    id: string;
    start: number;
    end: number;
    text: string;
    lines: string[];
  }>;
  output?: {
    videoStorageKey: string;
    sourceVideoStorageKey?: string;
    thumbnailStorageKey?: string;
  };
  error?: string;
  failedStage?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

@Injectable()
export class JobStoreService {
  constructor(private readonly firestore: FirestoreService) {}

  async create(businessId: string, data: Partial<AdJob>): Promise<string> {
    const projectsRef = this.firestore.collection(
      `businesses/${businessId}/projects`,
    );
    const docRef = await projectsRef.add({
      ...data,
      status: 'created',
      progress: 0,
      stages: {
        scrape: 'pending',
        brief: 'pending',
        script: 'pending',
        scenes: 'pending',
        assets: 'pending',
        audio: 'pending',
        subtitles: 'pending',
        render: 'pending',
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return docRef.id;
  }

  async getById(businessId: string, projectId: string): Promise<AdJob> {
    const doc = await this.firestore
      .doc(`businesses/${businessId}/projects/${projectId}`)
      .get();

    if (!doc.exists) {
      throw new NotFoundException(
        `Project ${projectId} not found in business ${businessId}`,
      );
    }

    return { id: doc.id, ...doc.data() } as AdJob;
  }

  async update(
    businessId: string,
    projectId: string,
    updates: Partial<AdJob>,
  ): Promise<void> {
    await this.firestore
      .doc(`businesses/${businessId}/projects/${projectId}`)
      .update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }

  async listByBusiness(businessId: string): Promise<AdJob[]> {
    const snapshot = await this.firestore
      .collection(`businesses/${businessId}/projects`)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AdJob);
  }
}
