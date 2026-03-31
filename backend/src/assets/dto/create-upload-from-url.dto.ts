import { z } from 'zod';
import { createUploadUrlSchema } from './create-upload-url.dto';

export const createUploadFromUrlSchema = createUploadUrlSchema.extend({
  sourceUrl: z.string().url(),
});

export type CreateUploadFromUrlDto = z.infer<typeof createUploadFromUrlSchema>;
