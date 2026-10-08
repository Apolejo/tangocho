import { describe, expect, it } from 'vitest';
import { DeckSchema, WordSchema } from './schema.ts';

const valid = {
  id: 'kiru-wear',
  kanji: '着る',
  kana: 'きる',
  pos: 'verb',
  verbGroup: 2,
  meaning: { en: ['to wear', 'to put on'], es: ['ponerse', 'llevar puesto'] },
  note: { en: 'upper body', es: 'torso' },
  tags: ['clothes'],
  added: '2026-10-08',
  source: 'notebook-1 p.3',
};

const failsAt = (input: unknown, path: string) => {
  const result = WordSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain(path);
  }
};

describe('WordSchema', () => {
  it('accepts a complete word and a minimal one', () => {
    expect(WordSchema.safeParse(valid).success).toBe(true);
    expect(
      WordSchema.safeParse({
        id: 'aru',
        kana: 'ある',
        pos: 'verb',
        verbGroup: 1,
        meaning: { es: ['haber'] },
        tags: [],
        added: '2026-10-08',
      }).success,
    ).toBe(true);
  });

  it('requires a kebab-case id', () => {
    failsAt({ ...valid, id: 'Kiru' }, 'id');
    failsAt({ ...valid, id: 'kiru_wear' }, 'id');
    failsAt({ ...valid, id: '-kiru' }, 'id');
  });

  it('requires kana and a known pos', () => {
    failsAt({ ...valid, kana: undefined }, 'kana');
    failsAt({ ...valid, kana: '  ' }, 'kana');
    failsAt({ ...valid, pos: 'verbo' }, 'pos');
  });

  it('accepts only verb groups 1, 2 and 3', () => {
    failsAt({ ...valid, verbGroup: 4 }, 'verbGroup');
    failsAt({ ...valid, verbGroup: '2' }, 'verbGroup');
  });

  it('needs at least one language with one non-empty meaning', () => {
    failsAt({ ...valid, meaning: {} }, 'meaning');
    failsAt({ ...valid, meaning: { en: [], es: [] } }, 'meaning');
    failsAt({ ...valid, meaning: { en: [''] } }, 'meaning.en.0');
    failsAt({ ...valid, meaning: { fr: ['porter'] } }, 'meaning');
  });

  it('requires kebab-case tags and an ISO date', () => {
    failsAt({ ...valid, tags: ['Clothes'] }, 'tags.0');
    failsAt({ ...valid, added: '08/10/2026' }, 'added');
    failsAt({ ...valid, added: '2026-13-01' }, 'added');
  });

  it('rejects unknown fields and a malformed furigana', () => {
    const unknown = WordSchema.safeParse({ ...valid, romaji: 'kiru' });
    expect(unknown.success).toBe(false);
    if (!unknown.success) expect(unknown.error.issues[0]?.message).toContain('romaji');
    failsAt({ ...valid, furigana: ['着', 'き'] }, 'furigana.0');
    expect(
      WordSchema.safeParse({
        ...valid,
        furigana: [
          ['着', 'き'],
          ['る', ''],
        ],
      }).success,
    ).toBe(true);
  });
});

describe('DeckSchema', () => {
  const deck = {
    id: 'verbs-g1',
    name: { en: 'Verbs · Group 1', es: 'Verbos · Grupo 1', ja: '動詞・1グループ' },
    match: { pos: 'verb', verbGroup: 1 },
  };

  it('accepts a deck with pos, verbGroup and tags', () => {
    expect(DeckSchema.safeParse(deck).success).toBe(true);
    expect(DeckSchema.safeParse({ ...deck, match: { tags: ['occupations'] } }).success).toBe(true);
  });

  it('rejects an unknown match field and a name without Spanish', () => {
    const unknown = DeckSchema.safeParse({ ...deck, match: { foo: 'bar' } });
    expect(unknown.success).toBe(false);
    if (!unknown.success) {
      expect(unknown.error.issues[0]?.path.join('.')).toBe('match');
    }
    expect(DeckSchema.safeParse({ ...deck, name: { en: 'Verbs' } }).success).toBe(false);
  });
});
