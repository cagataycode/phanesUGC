import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdsService } from '../ads/ads.service';
import { LlmService } from '../ai/llm.service';
import { VeoService } from '../ai/veo.service';
import { ImagenService } from '../ai/imagen.service';
import { StorageService } from '../storage/storage.service';
import {
  AdStatus,
  StageStatus,
} from '../ads/dto/ad-response.dto';
import { CreateAdDto, Platform, AspectRatio, Language, Tone } from '../ads/dto/create-ad.dto';

/**
 * Pipeline Worker Service
 * Orchestrates the full ad generation pipeline
 * This runs asynchronously via Cloud Tasks/Pub/Sub
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private configService: ConfigService,
    private adsService: AdsService,
    private llmService: LlmService,
    private veoService: VeoService,
    private imagenService: ImagenService,
    private storageService: StorageService,
  ) {}

  /**
   * Process a complete ad generation pipeline
   * This is called asynchronously when a new ad job is created
   */
  async processAdJob(adId: string): Promise<void> {
    this.logger.log(`Starting pipeline for ad: ${adId}`);

    try {
      // Get the ad data
      const adStatus = await this.adsService.getAdStatus(adId);
      if (!adStatus) {
        this.logger.error(`Ad ${adId} not found`);
        return;
      }

      // Update status to processing
      await this.adsService.updateAdProgress(
        adId,
        AdStatus.PROCESSING,
        10,
        { scrape: StageStatus.DONE }, // Skip scraping for MVP
      );

      // For now, we'll create a minimal DTO from stored data
      // In production, we'd fetch from Firestore
      const dto = this.getMockDto();

      // Stage 1: Creative Brief Generation
      this.logger.log('Stage 1: Generating creative brief');
      await this.adsService.updateAdProgress(adId, AdStatus.PROCESSING, 20, {
        brief: StageStatus.RUNNING,
      });

      const brief = await this.llmService.generateCreativeBrief(dto);
      await this.adsService.markStageComplete(adId, 'brief', {
        creative_brief: brief,
      });

      // Stage 2: Script Generation
      this.logger.log('Stage 2: Generating script');
      await this.adsService.updateAdProgress(adId, AdStatus.PROCESSING, 40, {
        script: StageStatus.RUNNING,
      });

      const script = await this.llmService.generateScript(brief);
      await this.adsService.markStageComplete(adId, 'script', {
        script,
      });

      // Stage 3: Scene Planning
      this.logger.log('Stage 3: Planning scenes');
      await this.adsService.updateAdProgress(adId, AdStatus.PROCESSING, 50, {
        assets: StageStatus.RUNNING,
      });

      const scenes = await this.llmService.planScenes(script, brief);

      // Generate visuals for each scene concurrently to save massive amounts of time
      await Promise.all(
        scenes.map(async (scene) => {
          if (scene.visual_type === 'generated') {
            // Use Imagen 4 for image generation
            const result = await this.imagenService.generateImage(scene);
            scene.asset_url = result.image_url;
          } else if (scene.visual_type === 'stock_video') {
            // Use Veo 3 for video generation
            const result = await this.veoService.generateVideo(scene);
            scene.asset_url = result.video_url;
          }
        }),
      );

      await this.adsService.markStageComplete(adId, 'assets', {
        scenes,
      });

      // Stage 4: Voiceover Generation
      this.logger.log('Stage 4: Generating voiceover');
      await this.adsService.updateAdProgress(adId, AdStatus.PROCESSING, 70, {
        voice: StageStatus.RUNNING,
      });

      // Combine all voiceover lines
      const fullScript = script.voiceover_lines.map((l) => l.text).join(' ');
      const audioTrack = await this.veoService.generateVoiceover(
        fullScript,
        dto.voice_id,
      );

      await this.adsService.markStageComplete(adId, 'voice', {
        audio_track: audioTrack,
      });

      // Stage 5: Subtitle Generation
      this.logger.log('Stage 5: Generating subtitles');
      await this.adsService.updateAdProgress(adId, AdStatus.PROCESSING, 80, {
        subtitles: StageStatus.RUNNING,
      });

      const subtitleResult =
        await this.veoService.generateSubtitles(audioTrack);
      await this.adsService.markStageComplete(adId, 'subtitles', {
        subtitles: subtitleResult.subtitles,
      });

      // Stage 6: Video Rendering
      this.logger.log('Stage 6: Rendering final video');
      await this.adsService.updateAdProgress(adId, AdStatus.RENDERING, 90, {
        render: StageStatus.RUNNING,
      });

      // Generate final video with all assets
      const renderResult = await this.veoService.generateFullVideo(
        scenes,
        audioTrack,
      );

      await this.adsService.markStageComplete(adId, 'render', {
        video_url: renderResult.video_url,
        thumbnail_url: renderResult.thumbnail_url,
      });

      // Mark entire job as completed
      await this.adsService.updateAdProgress(adId, AdStatus.COMPLETED, 100, {
        render: StageStatus.DONE,
      });

      this.logger.log(`Pipeline completed for ad: ${adId}`);
    } catch (error) {
      this.logger.error(`Pipeline failed for ad: ${adId}`, error);
      await this.adsService.updateAdProgress(
        adId,
        AdStatus.FAILED,
        0,
        {},
        { error_message: String(error) },
      );
    }
  }

  /**
   * Regenerate a specific scene
   */
  async regenerateScene(adId: string, sceneId: number): Promise<void> {
    this.logger.log(`Regenerating scene ${sceneId} for ad: ${adId}`);

    try {
      // Get current ad data
      const adStatus = await this.adsService.getAdStatus(adId);
      if (!adStatus) {
        throw new Error(`Ad ${adId} not found`);
      }

      // TODO: Get scenes and script from Firestore
      // For now, trigger a new pipeline
      await this.processAdJob(adId);
    } catch (error) {
      this.logger.error(`Scene regeneration failed for ad: ${adId}`, error);
      throw error;
    }
  }

  /**
   * Mock DTO for development
   * In production, this would be fetched from Firestore
   */
  private getMockDto(): CreateAdDto {
    return {
      prompt: 'Create a 30 second TikTok ad',
      platform: Platform.TIKTOK,
      aspect_ratio: AspectRatio.RATIO_9_16,
      duration_sec: 30,
      language: Language.EN,
      tone: Tone.DIRECT,
      cta: 'Learn more',
    };
  }
}
