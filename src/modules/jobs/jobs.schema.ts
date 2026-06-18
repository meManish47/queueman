import { z } from 'zod';

export const CreateJobSchema = z.object({
  body: z.object({
    payload: z.any(),
    priority: z.number().int().optional().default(0),
  })
});
