import { z } from 'zod';

/** Corpo de resposta de GET /health e GET /health/ready (docs/api/openapi.yaml). */
export const statusSaudeSchema = z.object({
  status: z.literal('ok'),
});

export type StatusSaude = z.infer<typeof statusSaudeSchema>;
