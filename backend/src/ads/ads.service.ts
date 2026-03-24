import { Injectable } from '@nestjs/common';
import { CreateAdDto } from './dto/create-ad.dto';
import { AdJob, JobStoreService } from './services/job-store.service';
import { VertexAiService } from '../ai/vertex-ai.service';

@Injectable()
export class AdsService {
  constructor(
    private readonly jobStoreService: JobStoreService,
    private readonly vertexAiService: VertexAiService,
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
      await this.vertexAiService.generateVideoFromPrompt(job.prompt);

      this.jobStoreService.update(id, {
        status: 'completed',
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
