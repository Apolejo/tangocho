import { z } from 'zod';

/** Word and deck shapes from SPEC §5.1 and §5.2. Cross-field rules live in rules.ts. */

export const POS = ['verb', 'noun', 'i-adj', 'na-adj', 'adverb', 'phrase', 'other'] as const;
export type Pos = (typeof POS)[number];

export const VERB_GROUPS = [1, 2, 3] as const;
export type VerbGroup = (typeof VERB_GROUPS)[number];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NON_BLANK = /\S/;

export const IdSchema = z.string().regex(KEBAB, 'lowercase ASCII kebab-case, like kiru-wear');
const text = z.string().regex(NON_BLANK, 'must not be empty');

export const MeaningSchema = z
  .strictObject({
    en: z.array(text).optional(),
    es: z.array(text).optional(),
  })
  .refine((m) => (m.en?.length ?? 0) > 0 || (m.es?.length ?? 0) > 0, {
    message: 'needs at least one language with one meaning',
  });

export const FuriganaSchema = z.array(z.tuple([z.string(), z.string()]));

export const WordSchema = z.strictObject({
  id: IdSchema,
  kanji: text.optional(),
  kana: text,
  furigana: FuriganaSchema.optional(),
  pos: z.enum(POS),
  verbGroup: z.literal(VERB_GROUPS).optional(),
  meaning: MeaningSchema,
  note: z
    .strictObject({
      en: z.string().optional(),
      es: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string().regex(KEBAB, 'kebab-case tag')),
  added: z.iso.date(),
  source: z.string().optional(),
});
export type Word = z.infer<typeof WordSchema>;

export const LocalizedSchema = z.strictObject({
  en: text,
  es: text,
  ja: text.optional(),
});
export type Localized = z.infer<typeof LocalizedSchema>;

export const DeckMatchSchema = z.strictObject({
  pos: z.enum(POS).optional(),
  verbGroup: z.literal(VERB_GROUPS).optional(),
  tags: z.array(z.string()).optional(),
});
export type DeckMatch = z.infer<typeof DeckMatchSchema>;

export const DeckSchema = z.strictObject({
  id: IdSchema,
  name: LocalizedSchema,
  match: DeckMatchSchema,
});
export type Deck = z.infer<typeof DeckSchema>;

export const WordsFileSchema = z.array(WordSchema);
export const DecksFileSchema = z.array(DeckSchema);
