import { z } from 'zod';

export const createUploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  entityType: z.enum(['product', 'avatar']),
  assetType: z.enum(['image', 'video', 'audio', 'logo']),
  role: z
    .enum(['profile', 'reference', 'demo', 'voice_sample', 'brand'])
    .optional(),
});

export type CreateUploadUrlDto = z.infer<typeof createUploadUrlSchema>;
