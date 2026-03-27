import { z } from 'zod';

export const productDefaultsSchema = z.object({
  tone: z.string().optional(),
  targetAudience: z.string().optional(),
  language: z.string().optional(),
  cta: z.string().optional(),
});

export const brandAssetSchema = z.object({
  storageKey: z.string().min(1),
  type: z.enum(['image', 'video', 'logo']),
  filename: z.string().min(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  urls: z.array(z.string().min(1)).optional(),
  brandAssets: z.array(brandAssetSchema).optional(),
  defaults: productDefaultsSchema.optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
