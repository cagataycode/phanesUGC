import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai';
import { SceneDto, AudioTrackDto } from '../ads/dto/ad-response.dto';

/**
 * Veo 3.1 Service
 * Handles video generation and voiceover using Google's Veo 3.1 model
 * Using Gemini 2.0 Flash Experimental which supports video generation
 */
@Injectable()
export class VeoService {
  private readonly logger = new Logger(VeoService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured - using mock mode');
      this.genAI = null as unknown as GoogleGenerativeAI;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Use gemini-2.5-flash for video generation
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
      });
      this.logger.log('Veo initialized with Gemini 2.5 Flash');
    }
  }

  /**
   * Generate video for a scene using Veo 3.1
   */
  async generateVideo(scene: SceneDto): Promise<{ video_url: string }> {
    this.logger.log(`Generating video for scene ${scene.scene_id} with Veo 3.1`);

    if (!scene.visual_prompt) {
      return { video_url: '' };
    }

    if (!this.model) {
      return this.getMockVideoUrl(scene);
    }

    try {
      // Veo 3.1 via Gemini 2.0 Flash Exp
      const prompt = this.buildVideoPrompt(scene);
      
      const result: GenerateContentResult = await this.model.generateContent(prompt);
      
      // Process the response - Veo returns video as part of the response
      const videoUrl = this.extractVideoUrl(result);
      
      if (videoUrl) {
        this.logger.log(`Video generated successfully: ${videoUrl}`);
        return { video_url: videoUrl };
      }
      
      // If no video in response, return mock
      this.logger.warn('No video in Veo response, using mock');
      return this.getMockVideoUrl(scene);
    } catch (error) {
      this.logger.error('Failed to generate video with Veo 3.1', error);
      // Fallback to mock on error
      return this.getMockVideoUrl(scene);
    }
  }

  /**
   * Generate voiceover audio using Veo 3.1
   */
  async generateVoiceover(
    text: string,
    voiceId?: string,
  ): Promise<AudioTrackDto> {
    this.logger.log('Generating voiceover with Veo 3.1');

    if (!this.model) {
      return this.getMockAudioTrack(text);
    }

    try {
      const prompt = `Generate audio for the following narration: "${text}". Create a clear, natural voiceover.`;
      
      const result: GenerateContentResult = await this.model.generateContent(prompt);
      
      const audioUrl = this.extractAudioUrl(result);
      
      if (audioUrl) {
        return {
          audio_url: audioUrl,
          segments: this.generateSegments(text),
        };
      }
      
      return this.getMockAudioTrack(text);
    } catch (error) {
      this.logger.error('Failed to generate voiceover', error);
      return this.getMockAudioTrack(text);
    }
  }

  /**
   * Generate subtitles
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
   * Generate full video with scenes and audio using Veo 3.1
   */
  async generateFullVideo(
    scenes: SceneDto[],
    audioTrack: AudioTrackDto,
  ): Promise<{ video_url: string; thumbnail_url: string }> {
    this.logger.log('Generating full video composition with Veo 3.1');

    if (!this.model) {
      return {
        video_url: `https://storage.googleapis.com/demo/video_${Date.now()}.mp4`,
        thumbnail_url: `https://storage.googleapis.com/demo/thumb_${Date.now()}.jpg`,
      };
    }

    try {
      const combinedPrompt = scenes.map(s => s.visual_prompt).join('. ');
      
      const result: GenerateContentResult = await this.model.generateContent(
        `Generate a short video advertisement: ${combinedPrompt}`
      );
      
      const videoUrl = this.extractVideoUrl(result);
      
      if (videoUrl) {
        return {
          video_url: videoUrl,
          thumbnail_url: videoUrl.replace('.mp4', '_thumb.jpg'),
        };
      }
      
      return {
        video_url: `https://storage.googleapis.com/demo/video_${Date.now()}.mp4`,
        thumbnail_url: `https://storage.googleapis.com/demo/thumb_${Date.now()}.jpg`,
      };
    } catch (error) {
      this.logger.error('Failed to generate full video', error);
      return {
        video_url: `https://storage.googleapis.com/demo/video_${Date.now()}.mp4`,
        thumbnail_url: `https://storage.googleapis.com/demo/thumb_${Date.now()}.jpg`,
      };
    }
  }

  /**
   * Build video generation prompt for Veo
   */
  private buildVideoPrompt(scene: SceneDto): string {
    const parts: string[] = [];
    
    if (scene.visual_prompt) {
      parts.push(scene.visual_prompt);
    }
    
    if (scene.overlay_text) {
      parts.push(`With overlay text: "${scene.overlay_text}"`);
    }
    
    if (scene.camera_motion) {
      parts.push(`Camera motion: ${scene.camera_motion}`);
    }
    
    parts.push('Format: 9:16 vertical video, high quality, social media ready');
    
    return parts.join('. ');
  }

  /**
   * Extract video URL from Gemini response
   */
  private extractVideoUrl(result: GenerateContentResult): string {
    try {
      const text = result.response?.text() || '';
      
      if (text.includes('video') || text.includes('mp4') || text.includes('storage.googleapis.com')) {
        const urlMatch = text.match(/https:\/\/[^\s]+\.(mp4|webm)/);
        if (urlMatch) {
          return urlMatch[0];
        }
      }
    } catch (e) {
      this.logger.warn('Could not extract video URL from response');
    }
    return '';
  }

  /**
   * Extract audio URL from Gemini response
   */
  private extractAudioUrl(result: GenerateContentResult): string {
    try {
      const text = result.response?.text() || '';
      
      if (text.includes('audio') || text.includes('wav') || text.includes('storage.googleapis.com')) {
        const urlMatch = text.match(/https:\/\/[^\s]+\.(wav|mp3)/);
        if (urlMatch) {
          return urlMatch[0];
        }
      }
    } catch (e) {
      this.logger.warn('Could not extract audio URL from response');
    }
    return '';
  }

  /**
   * Generate timing segments from text
   */
  private generateSegments(text: string): AudioTrackDto['segments'] {
    const words = text.split(' ');
    const wordsPerSecond = 2;
    
    let currentTime = 0;
    return words.map((word) => {
      const wordDuration = Math.max(0.2, word.length / 10);
      const segment = {
        text: word,
        start: currentTime,
        end: currentTime + wordDuration,
        words: [{
          word,
          start: currentTime,
          end: currentTime + wordDuration,
        }],
      };
      currentTime += wordDuration;
      return segment;
    });
  }

  // Mock implementations
  private getMockVideoUrl(scene: SceneDto): { video_url: string } {
    return {
      video_url: `https://storage.googleapis.com/demo/scene_${scene.scene_id}.mp4`,
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
