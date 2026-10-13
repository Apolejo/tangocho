import type { Word } from '../data/schema.ts';
import { FORM_LABELS } from '../i18n/forms.ts';
import { translate, type Lang } from '../i18n/lang.ts';
import { meaningText } from '../i18n/localized.ts';
import { isForm } from '../lib/conjugate.ts';
import { displayForm } from '../lib/verbs.ts';

/**
 * Word reports (SPEC §5.7): a ⚑ opens a prefilled new issue on the repo, next to the data it
 * fixes. Nothing is sent until the issue is submitted on GitHub. Pure.
 */

export const REPO = 'Apolejo/tangocho';
export const REPORT_LABEL = 'word-report';

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

/** The issue body: what the app showed, then a line for what looks wrong. */
export function reportBody({ word, from, form, answer }: Report, lang: Lang): string {
  const line = (key: Parameters<typeof translate>[1], value: string) =>
    `- **${translate(lang, key)}:** ${value}`;
  const meaning = meaningText(word, lang).text;
  const lines = [
    line('report_id', `\`${word.id}\``),
    line('report_shown', shownWithReading(word)),
    ...(meaning === '' ? [] : [line('report_meaning', meaning)]),
    ...(form === undefined ? [] : [line('report_form', formLabel(form))]),
    ...(answer === undefined ? [] : [line('report_answer', answer)]),
    line('report_from', from),
    ...(word.source === undefined ? [] : [line('report_source', word.source)]),
  ];
  return `${lines.join('\n')}\n\n**${translate(lang, 'report_wrong')}**\n\n`;
}

/** The new-issue page, prefilled and labelled. */
export function reportUrl(report: Report, lang: Lang): string {
  const params = new URLSearchParams({
    labels: REPORT_LABEL,
    title: reportTitle(report, lang),
    body: reportBody(report, lang),
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/** The open reports, on GitHub. */
export const OPEN_REPORTS_PAGE = `https://github.com/${REPO}/issues?${new URLSearchParams({
  q: `is:issue is:open label:${REPORT_LABEL}`,
}).toString()}`;
