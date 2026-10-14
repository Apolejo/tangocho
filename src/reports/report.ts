import type { Word } from '../data/schema.ts';
import { FORM_LABELS } from '../i18n/forms.ts';
import { translate, type Lang } from '../i18n/lang.ts';
import { meaningText } from '../i18n/localized.ts';
import { isForm } from '../lib/conjugate.ts';
import { displayForm } from '../lib/verbs.ts';

/**
 * Word reports (SPEC §5.7): a ⚑ opens the repo's word-report issue form, its fields filled in,
 * next to the data it fixes. The form labels the issue itself, so a report from anyone counts.
 * Nothing is sent until the issue is submitted on GitHub. Pure.
 */

export const REPO = 'Apolejo/tangocho';
export const REPORT_LABEL = 'word-report';
/** The issue form, in .github/ISSUE_TEMPLATE/. */
export const REPORT_FORM = 'word-report.yml';

/** The form's fields the app fills in, by id, in the form's order. */
export const REPORT_FIELDS = [
  'word-id',
  'shown',
  'meaning',
  'form',
  'answer',
  'from',
  'source',
] as const;
export type ReportField = (typeof REPORT_FIELDS)[number];

export interface Report {
  word: Word;
  /** Where the report was made: the notebook, or a game's name. */
  from: string;
  /** The conjugation form it's about, if any (a form id). */
  form?: string;
  /** What the app gave for it: a game's answer, or a form as the notebook shows it. */
  answer?: string;
}

/** A word as the notebook shows it, with its reading: 書きます（かきます）. */
function shownWithReading(word: Word): string {
  const { kanji, kana } = displayForm(word);
  return kanji === undefined ? kana : `${kanji}（${kana}）`;
}

const formLabel = (form: string): string => (isForm(form) ? FORM_LABELS[form] : form);

export function reportTitle({ word, form }: Report, lang: Lang): string {
  const shown = displayForm(word);
  const text = shown.kanji ?? shown.kana;
  return form === undefined
    ? translate(lang, 'report_title', { word: text, id: word.id })
    : translate(lang, 'report_title_form', { word: text, form: formLabel(form), id: word.id });
}

/** What the app showed, as the form's fields; what a report doesn't have is left out. */
export function reportFields(
  { word, from, form, answer }: Report,
  lang: Lang,
): [ReportField, string][] {
  const meaning = meaningText(word, lang).text;
  const fields: [ReportField, string | undefined][] = [
    ['word-id', word.id],
    ['shown', shownWithReading(word)],
    ['meaning', meaning === '' ? undefined : meaning],
    ['form', form === undefined ? undefined : formLabel(form)],
    ['answer', answer],
    ['from', from],
    ['source', word.source],
  ];
  return fields.filter((field): field is [ReportField, string] => field[1] !== undefined);
}

/** The new-issue page with the word-report form, filled in. */
export function reportUrl(report: Report, lang: Lang): string {
  const params = new URLSearchParams([
    ['template', REPORT_FORM],
    ['title', reportTitle(report, lang)],
    ...reportFields(report, lang),
  ]);
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/** The open reports, on GitHub. */
export const OPEN_REPORTS_PAGE = `https://github.com/${REPO}/issues?${new URLSearchParams({
  q: `is:issue is:open label:${REPORT_LABEL}`,
}).toString()}`;
