import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import { OPEN_REPORTS_PAGE, reportBody, reportTitle, reportUrl } from './report.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture ${id}`);
  return word;
};

describe('reportUrl', () => {
  it('opens a new issue on the repo, labelled word-report, title and body filled in', () => {
    const report = {
      word: byId('kaku'),
      from: 'Conjugation drill',
      form: 'て',
      answer: '書いて（かいて）',
    };
    const url = new URL(reportUrl(report, 'en'));
    expect(url.origin + url.pathname).toBe('https://github.com/Apolejo/tangocho/issues/new');
    expect(url.searchParams.get('labels')).toBe('word-report');
    expect(url.searchParams.get('title')).toBe(reportTitle(report, 'en'));
    expect(url.searchParams.get('body')).toBe(reportBody(report, 'en'));
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

describe('reportBody', () => {
  it('lists what the app showed, then a line for what looks wrong', () => {
    const body = reportBody(
      { word: byId('kaku'), from: 'Conjugation drill', form: 'て', answer: '書いて（かいて）' },
      'en',
    );
    expect(body).toBe(
      [
        '- **Word id:** `kaku`',
        '- **Shown as:** 書きます（かきます）',
        '- **Meaning:** to write',
        '- **Form:** て形',
        '- **App’s answer:** 書いて（かいて）',
        '- **From:** Conjugation drill',
        '- **Notebook page:** sample',
        '',
        '**What looks wrong:**',
        '',
        '',
      ].join('\n'),
    );
  });

  it('leaves out what a report doesn’t have', () => {
    const word: Word = { ...byId('sensei') };
    delete word.source;
    const body = reportBody({ word, from: 'Cuaderno' }, 'es');
    expect(body).toContain('- **Id de la palabra:** `sensei`');
    expect(body).toContain('- **Se muestra como:** 先生（せんせい）');
    expect(body).toContain('- **Significado:** profesor, maestro');
    expect(body).toContain('- **Desde:** Cuaderno');
    expect(body).not.toContain('Página del cuaderno');
    expect(body).not.toContain('Forma');
    expect(body).toMatch(/\*\*Qué parece estar mal:\*\*\n\n$/);
  });
});

describe('OPEN_REPORTS_PAGE', () => {
  it('lists the open word-report issues', () => {
    const url = new URL(OPEN_REPORTS_PAGE);
    expect(url.origin + url.pathname).toBe('https://github.com/Apolejo/tangocho/issues');
    expect(url.searchParams.get('q')).toBe('is:issue is:open label:word-report');
  });
});
