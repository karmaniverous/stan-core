/* src/stan/config/schema.ts
 * Minimal zod schema for stan.config.* (engine-only).
 * Tolerates unknown keys so legacy CLI fields remain compatible.
 */
import { z } from 'zod';

const StrictStringArray = z.array(z.string()).default([]).optional();

const ImportsValue = z.union([z.string(), z.array(z.string())]);
export const importsSchema = z.record(z.string(), ImportsValue).optional();

export const configSchema = z
  .object({
    stanPath: z
      .string()
      .min(1, { message: 'stanPath must be a non-empty string' }),
    includes: StrictStringArray,
    excludes: StrictStringArray,
    imports: importsSchema,
  })
  // Allow unknown keys to keep legacy CLI fields harmless during transition.
  .passthrough();

export type Config = z.infer<typeof configSchema>;
