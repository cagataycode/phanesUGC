import { Injectable } from '@nestjs/common';
import { CreateAdDto } from '../dto/create-ad.dto';
import { CreativeBrief } from '../types/creative-brief';

@Injectable()
export class BriefGenerationService {
  generate(createAdDto: CreateAdDto): CreativeBrief {
    const { prompt_inputs, veo_config } = createAdDto;
    const benefits = prompt_inputs.product_info?.benefits?.filter(Boolean);

    return {
      product_name: prompt_inputs.product_info?.name || undefined,
      offer: prompt_inputs.product_info?.description || undefined,
      audience: prompt_inputs.target_audience || undefined,
      pain_points: undefined,
      benefits: benefits?.length ? benefits : undefined,
      tone: prompt_inputs.tone || undefined,
      language: prompt_inputs.language || undefined,
      duration_sec: veo_config.duration_sec || undefined,
      platform: prompt_inputs.platform || undefined,
      cta: prompt_inputs.cta || undefined,
      visual_style: prompt_inputs.subtitle_style || undefined,
      aspect_ratio: veo_config.aspect_ratio || undefined,
    };
  }
}
