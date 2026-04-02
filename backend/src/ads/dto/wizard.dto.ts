import { z } from 'zod';

export const ProductInfoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  benefits: z.array(z.string()).optional(),
});

export const GenerateBriefSchema = z.object({
  businessId: z.string(),
  productId: z.string(),
  prompt: z.string().min(5),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  language: z.enum(['en', 'de']).optional(),
  tone: z.string().optional(),
  target_audience: z.string().optional(),
  cta: z.string().optional(),
  product_info: ProductInfoSchema.optional(),
});

export const GenerateScriptSchema = z.object({
  businessId: z.string(),
  brief: z.record(z.string(), z.unknown()),
});

export const GenerateSceneSchema = z.object({
  businessId: z.string(),
  brief: z.record(z.string(), z.unknown()),
  script: z.record(z.string(), z.unknown()),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  language: z.enum(['en', 'de']).optional(),
  tone: z.string().optional(),
  target_audience: z.string().optional(),
  cta: z.string().optional(),
  product_info: ProductInfoSchema.optional(),
});

export type GenerateBriefDto = z.infer<typeof GenerateBriefSchema>;
export type GenerateScriptDto = z.infer<typeof GenerateScriptSchema>;
export type GenerateSceneDto = z.infer<typeof GenerateSceneSchema>;
export type ProductInfoDto = z.infer<typeof ProductInfoSchema>;

// Wizard submission DTO - for submitting pre-generated brief/script/scene
export const WizardSubmitSchema = z.object({
  businessId: z.string(),
  productId: z.string(),
  createdBy: z.string().optional(),
  prompt: z.string(),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  language: z.enum(['en', 'de']).optional(),
  tone: z.string().optional(),
  target_audience: z.string().optional(),
  cta: z.string().optional(),
  product_info: ProductInfoSchema.optional(),
  aspect_ratio: z.enum(['9:16', '1:1', '16:9']),
  subtitle_style: z.enum(['standard', 'kinetic']).optional(),
  brief: z.record(z.string(), z.unknown()),
  script: z.record(z.string(), z.unknown()),
  scene: z.record(z.string(), z.unknown()),
});

export type WizardSubmitDto = z.infer<typeof WizardSubmitSchema>;
