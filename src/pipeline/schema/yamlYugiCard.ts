import { z } from 'zod';

/** Localized string field (`{ en, ja, ... }`) or a bare string. */
const Localized = z.union([
  z.string(),
  z.object({ en: z.string().optional().nullable() }).passthrough(),
]);

/**
 * Lenient schema for the subset of yaml-yugi fields we consume. Everything is
 * optional + passthrough so upstream additions never break the pipeline; the
 * defensive logic lives in `normalizeCard`.
 */
export const RawCardSchema = z
  .object({
    konami_id: z.number().optional().nullable(),
    password: z.number().optional().nullable(),
    name: Localized.optional().nullable(),
    text: Localized.optional().nullable(),
    card_type: z.string().optional().nullable(),
    monster_type_line: z.string().optional().nullable(),
    attribute: z.string().optional().nullable(),
    level: z.number().optional().nullable(),
    rank: z.number().optional().nullable(),
    link_arrows: z.array(z.string()).optional().nullable(),
    atk: z.union([z.number(), z.string()]).optional().nullable(),
    def: z.union([z.number(), z.string()]).optional().nullable(),
    series: z.array(z.string()).optional().nullable(),
    materials: z.union([z.string(), z.record(z.unknown())]).optional().nullable(),
    limit_regulation: z
      .object({
        tcg: z.string().optional().nullable(),
        ocg: z.string().optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export type RawCardParsed = z.infer<typeof RawCardSchema>;
