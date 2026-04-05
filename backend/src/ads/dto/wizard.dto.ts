import { z } from 'zod';

export const ProductInfoSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  benefits: z.array(z.string().max(200)).max(10).optional(),
});

export const GenerateBriefSchema = z.object({
  businessId: z.string().uuid('Business ID must be a valid UUID'),
  productId: z.string().uuid('Product ID must be a valid UUID'),
  prompt: z.string().min(5).max(2000, 'Prompt must not exceed 2000 characters'),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  language: z.enum(['en', 'de']).optional(),
  tone: z.string().max(50).optional(),
  target_audience: z.string().max(200).optional(),
  cta: z.string().max(100).optional(),
  product_info: ProductInfoSchema.optional(),
});

export const GenerateScriptSchema = z.object({
  businessId: z.string().uuid('Business ID must be a valid UUID'),
  brief: z.record(z.string(), z.unknown()),
});

export const GenerateSceneSchema = z.object({
  businessId: z.string().uuid('Business ID must be a valid UUID'),
  brief: z.record(z.string(), z.unknown()),
  script: z.record(z.string(), z.unknown()),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  language: z.enum(['en', 'de']).optional(),
  tone: z.string().max(50).optional(),
  target_audience: z.string().max(200).optional(),
  cta: z.string().max(100).optional(),
  product_info: ProductInfoSchema.optional(),
});

export type GenerateBriefDto = z.infer<typeof GenerateBriefSchema>;
export type GenerateScriptDto = z.infer<typeof GenerateScriptSchema>;
export type GenerateSceneDto = z.infer<typeof GenerateSceneSchema>;
export type ProductInfoDto = z.infer<typeof ProductInfoSchema>;

// Wizard submission DTO - for submitting pre-generated brief/script/scene
export const WizardSubmitSchema = z.object({
  businessId: z.string().uuid('Business ID must be a valid UUID'),
  productId: z.string().uuid('Product ID must be a valid UUID'),
  createdBy: z.string().optional(),
  prompt: z.string().max(2000, 'Prompt must not exceed 2000 characters'),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  language: z.enum(['en', 'de']).optional(),
  tone: z.string().max(50).optional(),
  target_audience: z.string().max(200).optional(),
  cta: z.string().max(100).optional(),
  product_info: ProductInfoSchema.optional(),
  aspect_ratio: z.enum(['9:16', '1:1', '16:9']),
  subtitle_style: z.enum(['standard', 'kinetic']).optional(),
  brief: z.record(z.string(), z.unknown()),
  script: z.record(z.string(), z.unknown()),
  scene: z.record(z.string(), z.unknown()),
});

export type WizardSubmitDto = z.infer<typeof WizardSubmitSchema>;
