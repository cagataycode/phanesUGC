import { Injectable, NotFoundException } from '@nestjs/common';
import { CreativeBrief } from '../types/creative-brief';

export type AdJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface AdJob {
  id: string;
  prompt: string;
  status: AdJobStatus;
  brief: CreativeBrief | null;
  videoUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class JobStoreService {
  private readonly jobs = new Map<string, AdJob>();

  create(prompt: string): AdJob {
    const now = new Date().toISOString();
    const job: AdJob = {
      id: crypto.randomUUID(),
      prompt,
      status: 'queued',
      brief: null,
      videoUrl: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(job.id, job);

    return job;
  }

  getById(id: string): AdJob {
    const job = this.jobs.get(id);

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    return job;
  }

  update(id: string, updates: Partial<Omit<AdJob, 'id' | 'createdAt'>>): AdJob {
    const existing = this.getById(id);

    const next: AdJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(id, next);

    return next;
  }
}
