export class CreateAdDto {
  prompt!: string;
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  duration_sec?: 5 | 6 | 7 | 8;
  negative_prompt?: string;
  person_generation?: 'allow_all' | 'allow_adult';
  enhance_prompt?: boolean;
}
