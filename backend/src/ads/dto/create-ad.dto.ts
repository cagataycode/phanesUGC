export class CreateAdDto {
  businessId!: string;
  productId!: string;
  createdBy!: string;
  prompt_inputs!: {
    prompt: string;
    platform: 'tiktok' | 'instagram' | 'youtube';
    language: string;
    tone?: string;
    target_audience?: string;
    cta?: string;
    product_info?: {
      name?: string;
      description?: string;
      benefits?: string[];
    };
    urls?: string[];
    subtitle_style?: string;
  };
  veo_config!: {
    aspect_ratio: '16:9' | '9:16' | '1:1';
    duration_sec: 8 | 15 | 30 | 60;
    negative_prompt?: string;
    person_generation?: 'allow_all' | 'allow_adult';
    enhance_prompt?: boolean;
  };
}
