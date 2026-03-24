import { Injectable } from '@nestjs/common';
import { CreateAdDto } from './dto/create-ad.dto';
import { AdJob, JobStoreService } from './services/job-store.service';

@Injectable()
export class AdsService {
  constructor(private readonly jobStoreService: JobStoreService) {}

  createJob(createAdDto: CreateAdDto): Pick<AdJob, 'id' | 'status'> {
    const job = this.jobStoreService.create(createAdDto.prompt);

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
}
