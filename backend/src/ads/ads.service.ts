import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Firestore as AdminFirestore,
  CollectionReference,
} from 'firebase-admin/firestore';
import { getFirebaseAdminDb, isFirebaseInitialized } from '../config/firebase.config';
import {
  CreateAdDto,
  Platform,
  AspectRatio,
  Language,
  SubtitleStyle,
} from './dto/create-ad.dto';
import {
  AdStatus,
  StageStatus,
  StageProgress,
  CreateAdResponseDto,
  AdStatusResponseDto,
  AdResultDto,
  ScriptDto,
  CreativeBriefDto,
  SceneDto,
  SubtitleSegment,
  AudioTrackDto,
} from './dto/ad-response.dto';

// In-memory store for mock mode
interface AdDocument {
  id: string;
  user_id: string;
  prompt: string;
  platform: string;
  aspect_ratio: string;
  duration_sec: number;
  language: string;
  tone?: string;
  target_audience?: string;
  cta?: string;
  product_info?: {
    name?: string;
    description?: string;
    benefits?: string[];
  };
  urls?: string[];
  brand_assets?: string[];
  subtitle_style?: string;
  voice_id?: string;
  status: string;
  progress: number;
  stages: StageProgress;
  error_message?: string;
  created_at: string;
  updated_at: string;
  creative_brief?: CreativeBriefDto;
  script?: ScriptDto;
  scenes?: SceneDto[];
  audio_track?: AudioTrackDto;
  subtitles?: SubtitleSegment[];
  video_url?: string;
  thumbnail_url?: string;
}

// In-memory storage for mock mode
const mockAdsStore: Map<string, AdDocument> = new Map();

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);
  private readonly adsCollection: CollectionReference | null;
  private readonly useMock: boolean;

  constructor(private configService: ConfigService) {
    this.useMock = !isFirebaseInitialized();
    
    if (this.useMock) {
      this.logger.warn('Running in mock mode - using in-memory storage');
      this.adsCollection = null;
    } else {
      try {
        const db = getFirebaseAdminDb();
        this.adsCollection = db.collection('ads');
      } catch (error) {
        this.logger.error('Failed to initialize Firestore', error);
        this.adsCollection = null;
        this.useMock = true;
      }
    }
  }

  /**
   * Create a new ad generation job
   */
  async createAd(dto: CreateAdDto): Promise<CreateAdResponseDto> {
    const adId = this.generateAdId();
    const now = new Date().toISOString();

    const adData: AdDocument = {
      id: adId,
      user_id: dto.user_id || 'anonymous',
      prompt: dto.prompt,
      platform: dto.platform,
      aspect_ratio: dto.aspect_ratio,
      duration_sec: dto.duration_sec,
      language: dto.language || Language.EN,
      tone: dto.tone,
      target_audience: dto.target_audience,
      cta: dto.cta,
      product_info: dto.product_info,
      urls: dto.urls,
      brand_assets: dto.brand_assets,
      subtitle_style: dto.subtitle_style || SubtitleStyle.STANDARD,
      voice_id: dto.voice_id,
      status: AdStatus.QUEUED,
      progress: 0,
      stages: {
        scrape: StageStatus.PENDING,
        brief: StageStatus.PENDING,
        script: StageStatus.PENDING,
        assets: StageStatus.PENDING,
        voice: StageStatus.PENDING,
        subtitles: StageStatus.PENDING,
        render: StageStatus.PENDING,
      },
      created_at: now,
      updated_at: now,
    };

    if (this.useMock) {
      mockAdsStore.set(adId, adData);
    } else if (this.adsCollection) {
      await this.adsCollection.doc(adId).set(adData);
    }

    this.logger.log(`Created ad job: ${adId}`);

    return {
      id: adId,
      status: AdStatus.QUEUED,
    };
  }

  /**
   * Get ad status by ID
   */
  async getAdStatus(adId: string): Promise<AdStatusResponseDto | null> {
    let data: AdDocument | undefined;

    if (this.useMock) {
      data = mockAdsStore.get(adId);
    } else if (this.adsCollection) {
      const doc = await this.adsCollection.doc(adId).get();
      data = doc.data() as AdDocument | undefined;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      status: data.status as AdStatus,
      progress: data.progress,
      stages: data.stages,
      error_message: data.error_message,
    };
  }

  /**
   * Get ad result (only available when status is completed)
   */
  async getAdResult(adId: string): Promise<AdResultDto | null> {
    let data: AdDocument | undefined;

    if (this.useMock) {
      data = mockAdsStore.get(adId);
    } else if (this.adsCollection) {
      const doc = await this.adsCollection.doc(adId).get();
      data = doc.data() as AdDocument | undefined;
    }

    if (!data) {
      return null;
    }

    if (data.status !== AdStatus.COMPLETED) {
      return null;
    }

    return {
      video_url: data.video_url || '',
      thumbnail_url: data.thumbnail_url || '',
      script: data.script || { title: '', hook: '', voiceover_lines: [], cta: '' },
      subtitles: data.subtitles || [],
      transcript: data.audio_track?.segments || [],
      metadata: {
        platform: data.platform,
        aspect_ratio: data.aspect_ratio,
        duration_sec: data.duration_sec,
        language: data.language,
        created_at: data.created_at,
      },
    };
  }

  /**
   * Regenerate a specific scene
   */
  async regenerateScene(
    adId: string,
    sceneId: number,
  ): Promise<{ success: boolean }> {
    let data: AdDocument | undefined;

    if (this.useMock) {
      data = mockAdsStore.get(adId);
    } else if (this.adsCollection) {
      const doc = await this.adsCollection.doc(adId).get();
      data = doc.data() as AdDocument | undefined;
    }

    if (!data) {
      return { success: false };
    }

    return { success: true };
  }

  /**
   * Update ad progress and stages
   */
  async updateAdProgress(
    adId: string,
    status: AdStatus,
    progress: number,
    stages: Partial<StageProgress>,
    additionalData?: Partial<AdDocument>,
  ): Promise<void> {
    const updateData: Partial<AdDocument> = {
      status,
      progress,
      stages: { ...stages } as unknown as StageProgress,
      updated_at: new Date().toISOString(),
      ...additionalData,
    };

    if (this.useMock) {
      const existing = mockAdsStore.get(adId);
      if (existing) {
        mockAdsStore.set(adId, { ...existing, ...updateData });
      }
    } else if (this.adsCollection) {
      await this.adsCollection.doc(adId).update(updateData);
    }
  }

  /**
   * Mark a specific stage as completed
   */
  async markStageComplete(
    adId: string,
    stage: keyof StageProgress,
    data?: Record<string, unknown>,
  ): Promise<void> {
    let currentData: AdDocument | undefined;

    if (this.useMock) {
      currentData = mockAdsStore.get(adId);
    } else if (this.adsCollection) {
      const doc = await this.adsCollection.doc(adId).get();
      currentData = doc.data() as AdDocument | undefined;
    }

    if (!currentData) {
      throw new Error(`Ad ${adId} not found`);
    }

    const stages = { ...currentData.stages };
    stages[stage] = StageStatus.DONE;

    const updateData: Partial<AdDocument> = {
      stages,
      updated_at: new Date().toISOString(),
      ...data,
    };

    if (this.useMock) {
      mockAdsStore.set(adId, { ...currentData, ...updateData });
    } else if (this.adsCollection) {
      await this.adsCollection.doc(adId).update(updateData);
    }
  }

  /**
   * Mark a specific stage as failed
   */
  async markStageFailed(
    adId: string,
    stage: keyof StageProgress,
    errorMessage: string,
  ): Promise<void> {
    let currentData: AdDocument | undefined;

    if (this.useMock) {
      currentData = mockAdsStore.get(adId);
    } else if (this.adsCollection) {
      const doc = await this.adsCollection.doc(adId).get();
      currentData = doc.data() as AdDocument | undefined;
    }

    if (!currentData) {
      throw new Error(`Ad ${adId} not found`);
    }

    const stages = { ...currentData.stages };
    stages[stage] = StageStatus.FAILED;

    const updateData = {
      status: AdStatus.FAILED,
      stages,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    };

    if (this.useMock) {
      mockAdsStore.set(adId, { ...currentData, ...updateData });
    } else if (this.adsCollection) {
      await this.adsCollection.doc(adId).update(updateData);
    }
  }

  /**
   * Generate a unique ad ID
   */
  private generateAdId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ad_${timestamp}_${random}`;
  }

  /**
   * Verify user owns the ad
   */
  async verifyAdOwnership(
    adId: string,
    userId: string,
  ): Promise<boolean> {
    let data: AdDocument | undefined;

    if (this.useMock) {
      data = mockAdsStore.get(adId);
    } else if (this.adsCollection) {
      const doc = await this.adsCollection.doc(adId).get();
      data = doc.data() as AdDocument | undefined;
    }

    if (!data) {
      return false;
    }

    return data.user_id === userId;
  }
}
