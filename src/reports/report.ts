import type { Word } from '../data/schema.ts';
import { FORM_LABELS } from '../i18n/forms.ts';
import type { MessageKey } from '../i18n/en.ts';
import { translate, type Lang } from '../i18n/lang.ts';
import { meaningText } from '../i18n/localized.ts';
import { isForm } from '../lib/conjugate.ts';
import { displayForm } from '../lib/verbs.ts';

/**
 * Word reports (SPEC §5.7): a ⚑ opens an email to the report address, its subject and body filled
 * in with what the app showed. Nothing is sent until the reporter sends it from their own mail
 * app. Pure.
 */

/** An email forward at my domain (Porkbun). It sits in the public build, so it can be retired. */
export const REPORT_EMAIL = 'no-reply@apolejo.dev';

/** What a report says about the word, by id, in the order the email lists them. */
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

/** How the email names each field. */
const FIELD_LABELS: Record<ReportField, MessageKey> = {
  'word-id': 'report_field_word_id',
  shown: 'report_field_shown',
  meaning: 'report_field_meaning',
  form: 'report_field_form',
  answer: 'report_field_answer',
  from: 'report_field_from',
  source: 'report_field_source',
};

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

/** What the app showed, as fields; what a report doesn't have is left out. */
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

/** A blank for the reporter to write in, then what the app showed, one field per line. */
export function reportBody(report: Report, lang: Lang): string {
  const details = reportFields(report, lang).map(
    ([field, value]) => `${translate(lang, FIELD_LABELS[field])}: ${value}`,
  );
  return [
    translate(lang, 'report_mail_prompt'),
    '',
    '',
    '---',
    translate(lang, 'report_mail_details'),
    ...details,
  ].join('\r\n');
}

/**
 * The email, as a mailto: link. Encoded by hand: URLSearchParams writes a space as "+", which a
 * mail app shows as a plus sign (RFC 6068 wants %20).
 */
export function reportMailto(report: Report, lang: Lang): string {
  const subject = encodeURIComponent(reportTitle(report, lang));
  const body = encodeURIComponent(reportBody(report, lang));
  return `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`;
}
