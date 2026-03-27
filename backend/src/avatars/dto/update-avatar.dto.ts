import { z } from 'zod';
import { createAvatarSchema } from './create-avatar.dto';

export const updateAvatarSchema = createAvatarSchema.partial();

export type UpdateAvatarDto = z.infer<typeof updateAvatarSchema>;
