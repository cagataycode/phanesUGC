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

    void this.processJob(job.id);

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

  private async processJob(id: string): Promise<void> {
    const job = this.jobStoreService.getById(id);

    this.jobStoreService.update(id, {
      status: 'processing',
      error: null,
    });

    try {
      const generatedAsset = await this.vertexAiService.generateVideoFromPrompt(job.prompt);
      if (!generatedAsset.downloadUrl) {
        throw new Error('Vertex AI did not return a downloadable video URL');
      }

      const objectPath = await this.gcsStorageService.uploadFromUrl(
        generatedAsset.downloadUrl,
        `ads/${id}/${generatedAsset.providerJobId}.mp4`,
      );
      const videoUrl = await this.gcsStorageService.createSignedVideoUrl(objectPath);

      this.jobStoreService.update(id, {
        status: 'completed',
        videoUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Video generation failed';

      this.jobStoreService.update(id, {
        status: 'failed',
        error: message,
      });
    }
  }
}
