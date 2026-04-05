import {
  IsString,
  IsUUID,
  IsNotEmpty,
  IsEnum,
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
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  benefits?: string[];
}

class PromptInputsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000, { message: 'Prompt must not exceed 2000 characters' })
  // Note: Currently only string prompts are supported in DTO validation.
  // If structured prompt objects are needed, update this validation and downstream services.
  prompt!: string;

  @IsIn(['tiktok', 'instagram', 'youtube'], {
    message: 'Platform must be one of: tiktok, instagram, youtube',
  })
  @IsNotEmpty()
  platform!: 'tiktok' | 'instagram' | 'youtube';

  @IsString()
  @MaxLength(10)
  @IsNotEmpty()
  language!: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  tone?: string;

  @IsString()
  @MaxLength(200)
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

  @IsEnum(['standard', 'kinetic'])
  @IsOptional()
  subtitle_style?: 'standard' | 'kinetic';
}

class VeoConfigDto {
  @IsEnum(['16:9', '9:16', '1:1'], {
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
  @MaxLength(500)
  @IsOptional()
  negative_prompt?: string;

  @IsEnum(['allow_all', 'allow_adult'])
  @IsOptional()
  person_generation?: 'allow_all' | 'allow_adult';

  @IsBoolean()
  @IsOptional()
  enhance_prompt?: boolean;
}

export class CreateAdDto {
  @IsUUID('4', { message: 'Business ID must be a valid UUID' })
  @IsNotEmpty()
  businessId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
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
