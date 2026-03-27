import { z } from 'zod';

export const avatarAppearanceSchema = z
  .object({
    hair: z.string().optional(),
    outfit: z.string().optional(),
    style: z.string().optional(),
  })
  .strict();

export const avatarVoiceProfileSchema = z
  .object({
    voiceId: z.string().optional(),
    provider: z.string().optional(),
    language: z.string().optional(),
  })
  .strict();

export const avatarPersonaSchema = z
  .object({
    tone: z.string().optional(),
    targetAudience: z.string().optional(),
    ctaStyle: z.string().optional(),
  })
  .strict();

export const avatarAssetSchema = z
  .object({
    storageKey: z.string().min(1),
    type: z.enum(['image', 'video', 'audio']),
    filename: z.string().min(1),
    role: z.enum(['profile', 'reference', 'demo', 'voice_sample']).optional(),
  })
  .strict();

export const createAvatarSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['ugc_creator', 'brand_rep', 'voice_only']),
    gender: z.string().optional(),
    ageRange: z.string().optional(),
    locale: z.string().optional(),
    appearance: avatarAppearanceSchema.optional(),
    voiceProfile: avatarVoiceProfileSchema.optional(),
    persona: avatarPersonaSchema.optional(),
    assets: z.array(avatarAssetSchema).optional(),
    thumbnailStorageKey: z.string().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type CreateAvatarDto = z.infer<typeof createAvatarSchema>;
