import { describe, expect, it } from 'vitest';
import form from '../../.github/ISSUE_TEMPLATE/word-report.yml?raw';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import {
  OPEN_REPORTS_PAGE,
  REPORT_FIELDS,
  REPORT_LABEL,
  reportFields,
  reportTitle,
  reportUrl,
} from './report.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture ${id}`);
  return word;
};

describe('reportUrl', () => {
  it('opens the word-report form on the repo, its fields and title filled in', () => {
    const report = {
      word: byId('kaku'),
      from: 'Conjugation drill',
      form: 'て',
      answer: '書いて（かいて）',
    };
    const url = new URL(reportUrl(report, 'en'));
    expect(url.origin + url.pathname).toBe('https://github.com/Apolejo/tangocho/issues/new');
    expect(url.searchParams.get('template')).toBe('word-report.yml');
    expect(url.searchParams.get('title')).toBe(reportTitle(report, 'en'));
    for (const [id, value] of reportFields(report, 'en')) {
      expect(url.searchParams.get(id)).toBe(value);
    }
    // the form labels the issue: labels= needs permission to label, and the form makes the body
    expect(url.searchParams.has('labels')).toBe(false);
    expect(url.searchParams.has('body')).toBe(false);
  });
});

describe('reportTitle', () => {
  it('names the word as shown, the form if any, and the id', () => {
    expect(reportTitle({ word: byId('kaku'), from: 'Notebook' }, 'en')).toBe(
      'Word report: 書きます (kaku)',
    );
    expect(reportTitle({ word: byId('kaku'), from: 'Notebook', form: 'て' }, 'es')).toBe(
      'Reporte de palabra: 書きます · て形 (kaku)',
    );
  });
});

describe('reportFields', () => {
  it('fills in what the app showed, in the form’s order', () => {
    expect(
      reportFields(
        { word: byId('kaku'), from: 'Conjugation drill', form: 'て', answer: '書いて（かいて）' },
        'en',
      ),
    ).toEqual([
      ['word-id', 'kaku'],
      ['shown', '書きます（かきます）'],
      ['meaning', 'to write'],
      ['form', 'て形'],
      ['answer', '書いて（かいて）'],
      ['from', 'Conjugation drill'],
      ['source', 'sample'],
    ]);
  });

  it('leaves out what a report doesn’t have, the meaning in the UI language', () => {
    const word: Word = { ...byId('sensei') };
    delete word.source;
    expect(reportFields({ word, from: 'Cuaderno' }, 'es')).toEqual([
      ['word-id', 'sensei'],
      ['shown', '先生（せんせい）'],
      ['meaning', 'profesor, maestro'],
      ['from', 'Cuaderno'],
    ]);
  });
});

/** The issue form (.github/ISSUE_TEMPLATE/word-report.yml) read as text: no YAML parser needed. */
describe('the word-report form', () => {
  const ids = [...form.matchAll(/^\s+id:\s*(\S+)\s*$/gm)].map((m) => m[1]);

  it('is read', () => {
    expect(ids.length).toBeGreaterThan(REPORT_FIELDS.length);
  });

  it('has a field for every one the link fills in', () => {
    for (const field of REPORT_FIELDS) expect(ids).toContain(field);
  });

  it('has unique ids GitHub accepts', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('labels its issues word-report itself', () => {
    expect(form).toMatch(new RegExp(`^labels: \\[${REPORT_LABEL}\\]$`, 'm'));
  });
});

describe('OPEN_REPORTS_PAGE', () => {
  it('lists the open word-report issues', () => {
    const url = new URL(OPEN_REPORTS_PAGE);
    expect(url.origin + url.pathname).toBe('https://github.com/Apolejo/tangocho/issues');
    expect(url.searchParams.get('q')).toBe('is:issue is:open label:word-report');
  });
});
