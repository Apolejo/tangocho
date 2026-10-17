import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings.ts';

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
      furigana: false,
      lastExportAt: '2026-10-13T08:00:00.000Z',
    });
    expect(parseSettings(raw)).toEqual({
      goals: [
        { from: '2026-10-13', goal: 10 },
        { from: '2026-10-20', goal: 50 },
      ],
      furigana: false,
      lastExportAt: '2026-10-13T08:00:00.000Z',
    });
  });

  it('falls back field by field', () => {
    const raw = JSON.stringify({
      goals: [{ from: 'yesterday', goal: 20 }],
      furigana: 'no',
      lastExportAt: 'last week',
    });
    expect(parseSettings(raw)).toEqual({ goals: [], furigana: true });
    // settings that no longer exist (new cards per day, retired in M13; the open word reports
    // count, retired with the GitHub issues) are dropped
    expect(parseSettings(JSON.stringify({ newPerDay: 30, reportsBanner: true }))).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});
