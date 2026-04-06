import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsArray,
  IsUrl,
  ArrayMaxSize,
  ValidateNested,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProductInfoDto {
  @IsString()
  @MaxLength(300)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  benefits?: string[];
}

class PromptInputsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, { message: 'Prompt must not exceed 10000 characters' })
  // Note: Currently only string prompts are supported in DTO validation.
  // If structured prompt objects are needed, update this validation and downstream services.
  prompt!: string;

  @IsIn(['tiktok', 'instagram', 'youtube'], {
    message: 'Platform must be one of: tiktok, instagram, youtube',
  })
  @IsNotEmpty()
  platform!: 'tiktok' | 'instagram' | 'youtube';

  @IsString()
  @IsNotEmpty()
  @IsIn(['en', 'de', 'es', 'fr', 'it', 'pt', 'ja', 'ko', 'zh'], {
    message:
      'Language must be a valid 2-letter ISO code: en, de, es, fr, it, pt, ja, ko, zh',
  })
  language!: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  tone?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  target_audience?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  cta?: string;

  @ValidateNested()
  @Type(() => ProductInfoDto)
  @IsOptional()
  product_info?: ProductInfoDto;

  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  urls?: string[];

  @IsIn(['standard', 'kinetic'])
  @IsOptional()
  subtitle_style?: 'standard' | 'kinetic';
}

class VeoConfigDto {
  @IsIn(['16:9', '9:16', '1:1'], {
    message: 'Aspect ratio must be one of: 16:9, 9:16, 1:1',
  })
  @IsNotEmpty()
  aspect_ratio!: '16:9' | '9:16' | '1:1';

  @IsInt()
  @Min(8)
  @Max(8)
  @IsNotEmpty()
  // MVP: Duration is fixed at 8 seconds. Vertex AI Veo supports 8|15|30|60 seconds,
  // but the current pipeline and scene generation are optimized for 8-second ads only.
  duration_sec!: number;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  negative_prompt?: string;

  @IsIn(['allow_all', 'allow_adult'])
  @IsOptional()
  person_generation?: 'allow_all' | 'allow_adult';

  @IsBoolean()
  @IsOptional()
  enhance_prompt?: boolean;
}

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string; // Firestore auto-generated ID

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  createdBy!: string;

  @ValidateNested()
  @Type(() => PromptInputsDto)
  @IsObject()
  @IsNotEmpty()
  prompt_inputs!: PromptInputsDto;

  @ValidateNested()
  @Type(() => VeoConfigDto)
  @IsObject()
  @IsNotEmpty()
  veo_config!: VeoConfigDto;
}
