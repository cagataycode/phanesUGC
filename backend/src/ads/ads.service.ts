import { Injectable } from '@nestjs/common';
import { CreateAdDto } from './dto/create-ad.dto';
import { AdJob, JobStoreService } from './services/job-store.service';
import { VertexAiService } from '../ai/vertex-ai.service';
import { GcsStorageService } from '../storage/gcs-storage.service';

@Injectable()
export class AdsService {
  constructor(
    private readonly jobStoreService: JobStoreService,
    private readonly vertexAiService: VertexAiService,
    private readonly gcsStorageService: GcsStorageService,
  ) {}

  createJob(createAdDto: CreateAdDto): Pick<AdJob, 'id' | 'status'> {
    const job = this.jobStoreService.create(createAdDto.prompt);

    void this.processJob(job.id, createAdDto);

    return {
      id: job.id,
      status: job.status,
    };
  }

  getJob(id: string): {
    id: string;
    status: AdJob['status'];
    video_url?: string;
    error?: string;
  } {
    const job = this.jobStoreService.getById(id);

    return {
      id: job.id,
      status: job.status,
      ...(job.videoUrl ? { video_url: job.videoUrl } : {}),
      ...(job.error ? { error: job.error } : {}),
    };
  }

  private buildComposedPrompt(createAdDto: CreateAdDto): string {
    const sections: string[] = [createAdDto.prompt.trim()];

    const creativeContext: string[] = [];

    if (createAdDto.platform) {
      creativeContext.push(`Platform: ${createAdDto.platform}`);
    }

    if (createAdDto.language) {
      creativeContext.push(`Language: ${createAdDto.language}`);
    }

    if (createAdDto.tone) {
      creativeContext.push(`Tone: ${createAdDto.tone}`);
    }

    if (createAdDto.target_audience) {
      creativeContext.push(`Target audience: ${createAdDto.target_audience}`);
    }

    if (createAdDto.cta) {
      creativeContext.push(`Call to action: ${createAdDto.cta}`);
    }

    if (createAdDto.subtitle_style) {
      creativeContext.push(
        `Subtitle style preference: ${createAdDto.subtitle_style}`,
      );
    }

    if (creativeContext.length > 0) {
      sections.push(`Creative context:\n- ${creativeContext.join('\n- ')}`);
    }

    const productContext: string[] = [];

    if (createAdDto.product_info?.name) {
      productContext.push(`Product name: ${createAdDto.product_info.name}`);
    }

    if (createAdDto.product_info?.description) {
      productContext.push(
        `Product description: ${createAdDto.product_info.description}`,
      );
    }

    if (createAdDto.product_info?.benefits?.length) {
      productContext.push(
        `Product benefits: ${createAdDto.product_info.benefits.join(', ')}`,
      );
    }

    if (createAdDto.urls?.length) {
      productContext.push(`Reference URLs: ${createAdDto.urls.join(', ')}`);
    }

    if (productContext.length > 0) {
      sections.push(`Product context:\n- ${productContext.join('\n- ')}`);
    }

    return sections.join('\n\n');
  }

  private async processJob(
    id: string,
    createAdDto: CreateAdDto,
  ): Promise<void> {
    this.jobStoreService.update(id, {
      status: 'processing',
      error: null,
    });

    try {
      const composedPrompt = this.buildComposedPrompt(createAdDto);
      const generatedAsset = await this.vertexAiService.generateVideoFromPrompt(
        composedPrompt,
        {
          aspectRatio: createAdDto.aspect_ratio,
          durationSeconds: createAdDto.duration_sec,
          negativePrompt: createAdDto.negative_prompt,
          personGeneration: createAdDto.person_generation,
          enhancePrompt: createAdDto.enhance_prompt,
        },
      );
      if (!generatedAsset.downloadUrl) {
        throw new Error('Vertex AI did not return a downloadable video URL');
      }

      const objectPath = await this.gcsStorageService.importGeneratedVideo(
        generatedAsset.downloadUrl,
        `ads/${id}/${generatedAsset.providerJobId}.mp4`,
      );
      const videoUrl =
        await this.gcsStorageService.createSignedVideoUrl(objectPath);

      this.jobStoreService.update(id, {
        status: 'completed',
        videoUrl,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Video generation failed';

      this.jobStoreService.update(id, {
        status: 'failed',
        error: message,
      });
    }
  }
}
