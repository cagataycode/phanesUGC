import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { SceneDto, AudioTrackDto } from '../ads/dto/ad-response.dto';
import { StorageService } from '../storage/storage.service';

/**
 * Video Generation Service
 * Uses @google/genai SDK for Veo video generation via Vertex AI
 * The SDK handles LRO UUID polling correctly, unlike the raw REST API.
 */
@Injectable()
export class VeoService {
  private readonly logger = new Logger(VeoService.name);
  private projectId: string;
  private location: string;
  private modelName: string;
  private useMock: boolean = false;
  private ai: GoogleGenAI | null = null;

  constructor(
    private configService: ConfigService,
    private storageService: StorageService
  ) {
    this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT') || 'phanesugc';
    this.location = this.configService.get<string>('GOOGLE_CLOUD_LOCATION') || 'us-central1';
    this.modelName = this.configService.get<string>('GOOGLE_CLOUD_VEO_MODEL') || 'veo-3.0-fast-generate-001';

    try {
      this.ai = new GoogleGenAI({
        vertexai: true,
        project: this.projectId,
        location: this.location,
      });
      this.logger.log(`Veo service initialized (project: ${this.projectId}, location: ${this.location})`);
    } catch (error: any) {
      this.logger.warn(`Failed to initialize GoogleGenAI: ${error.message} - using mock mode`);
      this.useMock = true;
    }
  }

  /**
   * Generate video for a scene using Veo via @google/genai SDK
   */
  async generateVideo(scene: SceneDto): Promise<{ video_url: string }> {
    this.logger.log(`Generating video for scene ${scene.scene_id} with Veo`);

    if (!scene.visual_prompt) {
      return { video_url: '' };
    }

    if (this.useMock || !this.ai) {
      return this.getMockVideoUrl();
    }

    try {
      const prompt = this.buildVideoPrompt(scene);
      this.logger.log(`Calling Veo generateVideos with prompt: ${prompt.substring(0, 200)}...`);
      
      const videoUrl = await this.callVeoGenerateVideos(prompt, scene.scene_id?.toString());
      
      if (videoUrl) {
        this.logger.log(`Veo returned video URL: ${videoUrl}`);
        return { video_url: videoUrl };
      }
      
      return this.getMockVideoUrl();
      
    } catch (error: any) {
      this.logger.error('Failed to generate video with Veo', error.message || error);
      return this.getMockVideoUrl();
    }
  }

  /**
   * Call Veo using @google/genai SDK - handles UUID operation polling correctly
   */
  private async callVeoGenerateVideos(prompt: string, sceneIdSuffix: string = 'ad'): Promise<string | null> {
    try {
      this.logger.log('Starting Veo video generation operation...');
      
      let operation = await this.ai!.models.generateVideos({
        model: this.modelName,
        prompt,
        config: {
          numberOfVideos: 1,
          durationSeconds: 8,
          aspectRatio: '9:16',
        },
      });

      this.logger.log(`Operation started: ${operation.name}, done=${operation.done}`);

      // Poll until complete (max 10 minutes at 10s intervals)
      const maxAttempts = 60;
      let attempt = 0;
      while (!operation.done && attempt < maxAttempts) {
        attempt++;
        this.logger.log(`Polling Veo operation (attempt ${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await this.ai!.operations.getVideosOperation({ operation });
        this.logger.log(`Operation status: done=${operation.done}`);
      }

      if (!operation.done) {
        this.logger.error('Veo operation timed out after 10 minutes');
        return null;
      }

      if (operation.error) {
        this.logger.error(`Veo operation failed: ${JSON.stringify(operation.error)}`);
        return null;
      }

      const anyResponse = operation.response as any;
      const videos = anyResponse?.generatedVideos;
      
      if (videos && videos.length > 0) {
        const uri = videos[0]?.video?.uri;
        if (uri) {
          this.logger.log(`Veo generated video URI directly: ${uri}`);
          return uri;
        }

        // Veo SDK native fallback string buffer return if GCP output bucket wasn't defined
        const videoBytes = videos[0]?.video?.videoBytes || videos[0]?.videoBytes || anyResponse?.videoBytes;
        if (videoBytes) {
           this.logger.log(`Veo returned raw videoBytes (base64). Uploading buffer to Storage bucket natively...`);
           const buffer = Buffer.from(videoBytes, 'base64');
           const filename = `veo_video_${sceneIdSuffix}_${Date.now()}.mp4`;
           const uploadPath = `generated_assets/videos/${filename}`;
           
           try {
             await this.storageService.uploadFile(buffer, uploadPath, 'video/mp4');
             const signedUrl = await this.storageService.getSignedUrl(uploadPath, 604800); // 7 day access
             this.logger.log(`Successfully uploaded Veo Base64 video to storage: ${uploadPath}`);
             return signedUrl;
           } catch (uploadError: any) {
             this.logger.error(`Failed to natively upload Veo video bytes to GCS: ${uploadError.message}`);
             return null;
           }
        }
      }

      if (anyResponse?.videoUri) return anyResponse.videoUri;
      if (anyResponse?.videos?.[0]?.uri) return anyResponse.videos[0].uri;
      if (anyResponse?.predictions?.[0]?.videoUri) return anyResponse.predictions[0].videoUri;

      this.logger.warn(`Veo operation completed but couldn't locate video bytes or URI in response: ${JSON.stringify(operation).substring(0, 500)}`);
      return null;
    } catch (error: any) {
      this.logger.error(`Veo generateVideos call failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate voiceover audio - placeholder for MVP
   */
  async generateVoiceover(text: string, voiceId?: string): Promise<AudioTrackDto> {
    this.logger.log('Generating voiceover (placeholder for MVP)');
    return this.getMockAudioTrack(text);
  }

  /**
   * Generate subtitles from audio track
   */
  async generateSubtitles(audioTrack: AudioTrackDto): Promise<{ subtitles: { start: number; end: number; text: string }[] }> {
    this.logger.log('Generating subtitles');

    if (!audioTrack.segments || audioTrack.segments.length === 0) {
      return this.getMockSubtitles();
    }

    const subtitles = audioTrack.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
    }));

    return { subtitles };
  }

  /**
   * Generate full video - calls Veo for the complete ad
   */
  async generateFullVideo(scenes: SceneDto[], audioTrack: AudioTrackDto): Promise<{ video_url: string; thumbnail_url: string }> {
    this.logger.log('Generating full video composition with Veo');

    if (this.useMock || !this.ai) {
      return this.getMockResult();
    }

    try {
      const combinedPrompt = scenes.map(s => s.visual_prompt).filter(Boolean).join('. ');
      const videoUrl = await this.callVeoGenerateVideos(`Generate a short video advertisement: ${combinedPrompt}`);
      
      if (videoUrl) {
        return {
          video_url: videoUrl,
          thumbnail_url: videoUrl.replace('.mp4', '_thumb.jpg'),
        };
      }
      
      return this.getMockResult();
    } catch (error: any) {
      this.logger.error('Failed to generate full video', error.message || error);
      return this.getMockResult();
    }
  }

  private buildVideoPrompt(scene: SceneDto): string {
    const parts: string[] = [];
    
    if (scene.visual_prompt) parts.push(scene.visual_prompt);
    if (scene.overlay_text) parts.push(`With overlay text: "${scene.overlay_text}"`);
    if (scene.camera_motion) parts.push(`Camera motion: ${scene.camera_motion}`);
    
    parts.push('Format: 9:16 vertical video, high quality, social media ready');
    
    return parts.join('. ');
  }

  private generateSegments(text: string): AudioTrackDto['segments'] {
    const words = text.split(' ');
    let currentTime = 0;
    return words.map((word) => {
      const wordDuration = Math.max(0.2, word.length / 10);
      const segment = {
        text: word,
        start: currentTime,
        end: currentTime + wordDuration,
        words: [{ word, start: currentTime, end: currentTime + wordDuration }],
      };
      currentTime += wordDuration;
      return segment;
    });
  }

  private getMockVideoUrl(): { video_url: string } {
    return {
      video_url: `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`,
    };
  }

  private getMockResult(): { video_url: string; thumbnail_url: string } {
    return {
      video_url: `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`,
      thumbnail_url: `https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=400`,
    };
  }

  private getMockAudioTrack(text: string): AudioTrackDto {
    const segments = this.generateSegments(text);
    return {
      audio_url: `https://storage.googleapis.com/demo/audio_${Date.now()}.wav`,
      segments,
    };
  }

  private getMockSubtitles(): { subtitles: { start: number; end: number; text: string }[] } {
    return {
      subtitles: [
        { start: 0, end: 2, text: 'Welcome to your new ad' },
        { start: 2, end: 4, text: 'Create amazing content' },
        { start: 4, end: 6, text: 'Start now!' },
      ],
    };
  }
}
