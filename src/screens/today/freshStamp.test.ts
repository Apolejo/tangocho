import { describe, expect, it } from 'vitest';
import { freshStampDay } from './freshStamp.ts';

describe('freshStampDay', () => {
  it('presses today once its goal is met', () => {
    expect(freshStampDay('2026-10-14', true, null)).toBe('2026-10-14');
    expect(freshStampDay('2026-10-14', true, '2026-10-13')).toBe('2026-10-14');
  });

  it('never twice for the same day', () => {
    expect(freshStampDay('2026-10-14', true, '2026-10-14')).toBeUndefined();
  });

  it('not before the goal is met', () => {
    expect(freshStampDay('2026-10-14', false, null)).toBeUndefined();
  });
});
