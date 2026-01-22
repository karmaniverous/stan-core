/**
 * Zod schema for the `stan-core` config block; strict validation and derived
 * types for consumers; pure runtime parsing.
 * @module
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
  // Reject unknown keys inside the `stan-core` block.
  .strict();

export type Config = z.infer<typeof configSchema>;
