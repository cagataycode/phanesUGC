import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum Platform {
  TIKTOK = 'tiktok',
  INSTAGRAM_REELS = 'instagram_reels',
  YOUTUBE_SHORTS = 'youtube_shorts',
}

export enum AspectRatio {
  RATIO_9_16 = '9:16',
  RATIO_1_1 = '1:1',
}

export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
}

export enum Tone {
  DIRECT = 'direct',
  CASUAL = 'casual',
  PROFESSIONAL = 'professional',
  HUMOROUS = 'humorous',
  EMOTIONAL = 'emotional',
}

export enum SubtitleStyle {
  STANDARD = 'standard',
  KINETIC = 'kinetic',
}

export class ProductInfoDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  benefits?: string[];
}

export class CreateAdDto {
  @IsString()
  prompt: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsEnum(AspectRatio)
  aspect_ratio: AspectRatio;

  @IsNumber()
  @Min(5)
  @Max(60)
  duration_sec: number;

  @IsEnum(Language)
  @IsOptional()
  language?: Language = Language.EN;

  @IsEnum(Tone)
  @IsOptional()
  tone?: Tone;

  @IsString()
  @IsOptional()
  target_audience?: string;

  @IsString()
  @IsOptional()
  cta?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ProductInfoDto)
  @IsOptional()
  product_info?: ProductInfoDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  urls?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  brand_assets?: string[];

  @IsEnum(SubtitleStyle)
  @IsOptional()
  subtitle_style?: SubtitleStyle = SubtitleStyle.STANDARD;

  @IsString()
  @IsOptional()
  voice_id?: string;

  // User ID from Firebase Auth (will be extracted from token)
  @IsString()
  @IsOptional()
  user_id?: string;
}
