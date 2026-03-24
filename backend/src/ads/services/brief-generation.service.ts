import { Injectable } from '@nestjs/common';
import { CreateAdDto } from '../dto/create-ad.dto';
import { CreativeBrief } from '../types/creative-brief';

@Injectable()
export class BriefGenerationService {
  generate(createAdDto: CreateAdDto): CreativeBrief {
    const benefits = createAdDto.product_info?.benefits?.filter(Boolean);

    return {
      product_name: createAdDto.product_info?.name || undefined,
      offer: createAdDto.product_info?.description || undefined,
      audience: createAdDto.target_audience || undefined,
      pain_points: undefined,
      benefits: benefits?.length ? benefits : undefined,
      tone: createAdDto.tone || undefined,
      language: createAdDto.language || undefined,
      duration_sec: createAdDto.duration_sec || undefined,
      platform: createAdDto.platform || undefined,
      cta: createAdDto.cta || undefined,
      visual_style: createAdDto.subtitle_style || undefined,
      aspect_ratio: createAdDto.aspect_ratio || undefined,
    };
  }
}
