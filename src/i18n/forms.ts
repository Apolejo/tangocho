import type { ConjugationForm } from '../lib/conjugate.ts';

/**
 * How the app names each conjugation form: in Japanese whatever the UI language, so the real
 * terms become familiar (render them with lang="ja"). The form ids never change (SPEC §11).
 */
export const FORM_LABELS: Readonly<Record<ConjugationForm, string>> = {
  辞書形: '辞書形',
  ます: 'ます形',
  ません: 'ません',
  ました: 'ました',
  ませんでした: 'ませんでした',
  て: 'て形',
  ない: 'ない形',
  た: 'た形',
};
