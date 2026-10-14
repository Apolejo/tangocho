import { describe, expect, it } from 'vitest';
import { DEFAULT_NEW_PER_DAY, DEFAULT_SETTINGS, parseSettings } from './settings.ts';

describe('parseSettings', () => {
  it('gives the defaults for nothing stored, broken JSON or the wrong shape', () => {
    for (const raw of [null, '{', '"text"', '[]']) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('reads stored settings, goals sorted by day', () => {
    const raw = JSON.stringify({
      goals: [
        { from: '2026-10-20', goal: 50 },
        { from: '2026-10-13', goal: 10 },
      ],
      newPerDay: 5,
      furigana: false,
      lastExportAt: '2026-10-13T08:00:00.000Z',
    });
    expect(parseSettings(raw)).toEqual({
      goals: [
        { from: '2026-10-13', goal: 10 },
        { from: '2026-10-20', goal: 50 },
      ],
      newPerDay: 5,
      furigana: false,
      lastExportAt: '2026-10-13T08:00:00.000Z',
    });
  });

  it('falls back field by field', () => {
    const raw = JSON.stringify({
      goals: [{ from: 'yesterday', goal: 20 }],
      newPerDay: 7,
      furigana: 'no',
      lastExportAt: 'last week',
    });
    expect(parseSettings(raw)).toEqual({
      goals: [],
      newPerDay: DEFAULT_NEW_PER_DAY,
      furigana: true,
    });
    expect(parseSettings(JSON.stringify({ newPerDay: 30 }))).toEqual({
      ...DEFAULT_SETTINGS,
      newPerDay: 30,
    });
  });
});
