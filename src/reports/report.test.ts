import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import { REPORT_EMAIL, reportBody, reportFields, reportMailto, reportTitle } from './report.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture ${id}`);
  return word;
};

describe('reportMailto', () => {
  const report = {
    word: byId('kaku'),
    from: 'Conjugation drill',
    form: 'て',
    answer: '書いて（かいて）',
  };

  it('writes to the report address, the title as the subject and the fields in the body', () => {
    const link = reportMailto(report, 'en');
    const url = new URL(link);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(REPORT_EMAIL);
    expect(url.searchParams.get('subject')).toBe(reportTitle(report, 'en'));
    expect(url.searchParams.get('body')).toBe(reportBody(report, 'en'));
  });

  it('encodes spaces as %20, never "+", which a mail app would show as a plus sign', () => {
    const link = reportMailto(report, 'en');
    expect(link).toContain('subject=Word%20report');
    expect(link).not.toContain('+');
  });
});

describe('reportBody', () => {
  it('leaves room to write, then lists what the app showed, one field per line', () => {
    const report = {
      word: byId('kaku'),
      from: 'Conjugation drill',
      form: 'て',
      answer: '書いて（かいて）',
    };
    expect(reportBody(report, 'en').split('\r\n')).toEqual([
      'What looks wrong? Write it here:',
      '',
      '',
      '---',
      'What the app showed (please leave as it is):',
      'Word id: kaku',
      'Shown as: 書きます（かきます）',
      'Meaning: to write',
      'Form: て形',
      'App’s answer: 書いて（かいて）',
      'Reported from: Conjugation drill',
      'Notebook page: sample',
    ]);
  });

  it('is in the UI language, and leaves out what a report doesn’t have', () => {
    const word: Word = { ...byId('sensei') };
    delete word.source;
    expect(reportBody({ word, from: 'Cuaderno' }, 'es').split('\r\n')).toEqual([
      '¿Qué parece estar mal? Escríbelo aquí:',
      '',
      '',
      '---',
      'Lo que mostraba la app (déjalo como está):',
      'Id de la palabra: sensei',
      'Se muestra como: 先生（せんせい）',
      'Significado: profesor, maestro',
      'Reportado desde: Cuaderno',
    ]);
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
