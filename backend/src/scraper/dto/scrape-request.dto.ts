import { z } from 'zod';

export const ScrapeRequestSchema = z.object({
  url: z.string().url(),
  usePlaywrightFallback: z.boolean().optional(),
  extractBrandColors: z.boolean().optional(),
});

export type ScrapeRequestDto = z.infer<typeof ScrapeRequestSchema>;
