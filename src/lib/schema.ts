/**
 * Zod schemas mirroring `types.ts`.
 *
 * Used by the build pipeline and the data tests only — never imported by app
 * code, so Zod stays out of the browser bundle. The `satisfies` checks at the
 * bottom fail to compile if a schema and its type ever drift apart.
 */
import { z } from 'zod';
import { BOOKS } from './types.js';
import type {
  Aliyah,
  Attribution,
  Calendar,
  ComboAliyah,
  ParshaCombo,
  ParshaMeta,
  ParshaText,
  ParshiyotIndex,
  RashiComment,
  RashiText,
  RichRun,
  Verse,
} from './types.js';

export * from './types.js';

export const bookSchema = z.enum(BOOKS);

export const verseSchema = z.object({
  c: z.number().int().positive(),
  v: z.number().int().positive(),
  he: z.string().min(1),
  on: z.string(),
  en: z.string(),
});

export const aliyahSchema = z.object({
  n: z.number().int().min(1),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  startRef: z.string(),
  endRef: z.string(),
});

export const parshaTextSchema = z.object({
  slug: z.string().min(1),
  book: bookSchema,
  nameEn: z.string().min(1),
  nameHe: z.string().min(1),
  aliyot: z.array(aliyahSchema).min(1),
  verses: z.array(verseSchema).min(1),
});

export const richRunSchema = z.object({
  t: z.string(),
  b: z.literal(true).optional(),
});

export const rashiCommentSchema = z.object({
  he: z.array(richRunSchema),
  en: z.array(richRunSchema),
});

export const rashiTextSchema = z.object({
  slug: z.string().min(1),
  comments: z.record(z.string(), z.array(rashiCommentSchema)),
});

export const parshaMetaSchema = z.object({
  slug: z.string().min(1),
  book: bookSchema,
  nameEn: z.string().min(1),
  nameHe: z.string().min(1),
  order: z.number().int().min(1).max(54),
  verseCount: z.number().int().positive(),
  aliyotCount: z.number().int().positive(),
  ref: z.string().min(1),
});

export const comboAliyahSchema = z.object({
  n: z.number().int().min(1).max(7),
  startRef: z.string().min(1),
  endRef: z.string().min(1),
});

export const parshaComboSchema = z.object({
  slug: z.string().min(1),
  parts: z.tuple([z.string().min(1), z.string().min(1)]),
  nameEn: z.string().min(1),
  nameHe: z.string().min(1),
  aliyot: z.array(comboAliyahSchema).length(7),
});

export const parshiyotIndexSchema = z.object({
  parshiyot: z.array(parshaMetaSchema).length(54),
  combos: z.array(parshaComboSchema).min(1),
});

export const calendarSchema = z.object({
  firstShabbat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  diaspora: z.array(z.string()),
  israel: z.array(z.string()),
});

export const attributionSchema = z.object({
  generatedAt: z.string(),
  editions: z.array(
    z.object({
      role: z.string(),
      title: z.string(),
      license: z.string(),
      language: z.string(),
    }),
  ),
});

// Compile-time proof that each schema still produces exactly its type.
type Conforms<S extends z.ZodType, T> = z.infer<S> extends T
  ? T extends z.infer<S>
    ? true
    : never
  : never;

export const __schemaConformance = {
  verse: true as Conforms<typeof verseSchema, Verse>,
  aliyah: true as Conforms<typeof aliyahSchema, Aliyah>,
  parshaText: true as Conforms<typeof parshaTextSchema, ParshaText>,
  richRun: true as Conforms<typeof richRunSchema, RichRun>,
  rashiComment: true as Conforms<typeof rashiCommentSchema, RashiComment>,
  rashiText: true as Conforms<typeof rashiTextSchema, RashiText>,
  parshaMeta: true as Conforms<typeof parshaMetaSchema, ParshaMeta>,
  comboAliyah: true as Conforms<typeof comboAliyahSchema, ComboAliyah>,
  parshaCombo: true as Conforms<typeof parshaComboSchema, ParshaCombo>,
  parshiyotIndex: true as Conforms<typeof parshiyotIndexSchema, ParshiyotIndex>,
  calendar: true as Conforms<typeof calendarSchema, Calendar>,
  attribution: true as Conforms<typeof attributionSchema, Attribution>,
} as const;
