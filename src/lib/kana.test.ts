import { describe, expect, it } from 'vitest';
import { answerKey, finishKana, typeKana } from './kana.ts';

/** Types key by key at the end of the input, as the input component does. */
function typed(keys: string, expected: string): string {
  let value = '';
  for (const key of keys) value = typeKana(value + key, value.length + key.length, expected).value;
  return value;
}

/** Typed, submitted and keyed, as the game compares it. */
const submitted = (keys: string, expected: string): string =>
  answerKey(finishKana(typed(keys, expected), expected));

describe('typeKana: romaji converts as I type (SPEC §9.3)', () => {
  it('into hiragana or katakana to match the expected answer', () => {
    expect(typed('taberu', 'たべる')).toBe('たべる');
    expect(typed('dezaina-', 'デザイナー')).toBe('デザイナー');
    expect(typed('konpyu-ta-', 'コンピューター')).toBe('コンピューター');
  });

  it('position by position in mixed words', () => {
    expect(typed('kopi-suru', 'コピーする')).toBe('コピーする');
    expect(typed('keshigomu', 'けしゴム')).toBe('けしゴム');
  });

  it('keeps a trailing n waiting for the next letter', () => {
    expect(typed('kaishain', 'かいしゃいん')).toBe('かいしゃいn');
    expect(typed('sarari-man', 'サラリーマン')).toBe('サラリーマn');
    expect(typed('kanojo', 'かのじょ')).toBe('かのじょ');
    // like a Japanese IME, nn is ん: こんにちは takes nnn, or n'
    expect(typed('konnichiha', 'こんにちは')).toBe('こんいちは');
    expect(typed('konnnichiha', 'こんにちは')).toBe('こんにちは');
    expect(typed("kon'nichiha", 'こんにちは')).toBe('こんにちは');
    expect(typed("kon'ya", 'こんや')).toBe('こんや');
  });

  it('ignores capitals and full-width letters (phones capitalize the first letter)', () => {
    expect(typed('Taberu', 'たべる')).toBe('たべる');
    expect(typed('TABERU', 'たべる')).toBe('たべる');
    expect(typed('ｔａｂｅｒｕ', 'たべる')).toBe('たべる');
    expect(typed('KO-HI-', 'コーヒー')).toBe('コーヒー');
  });

  it('leaves kana and kanji from a Japanese keyboard as typed', () => {
    expect(typeKana('食べる', 3, 'たべる')).toEqual({ value: '食べる', caret: 3 });
    expect(typeKana('タベル', 3, 'たべる')).toEqual({ value: 'タベル', caret: 3 });
    expect(typeKana('ﾃﾞｻﾞｲﾅｰ', 7, 'デザイナー').value).toBe('デザイナー');
    expect(typed('たべru', 'たべる')).toBe('たべる');
  });

  it('converts before the caret and keeps it in place', () => {
    expect(typeKana('かいkaしゃいん', 4, 'かいかしゃいん')).toEqual({
      value: 'かいかしゃいん',
      caret: 3,
    });
    expect(typeKana('かいkしゃいん', 3, 'かいかしゃいん')).toEqual({
      value: 'かいkしゃいん',
      caret: 3,
    });
  });
});

describe('finishKana: submitting finishes the conversion in the expected script', () => {
  it('turns a trailing n into ん or ン', () => {
    expect(finishKana('かいしゃいn', 'かいしゃいん')).toBe('かいしゃいん');
    expect(finishKana('サラリーマn', 'サラリーマン')).toBe('サラリーマン');
    expect(finishKana('サラリーマn', 'サラリーマン')).not.toBe('サラリーマん');
  });

  it('converts romaji that never went through the input, and drops spaces', () => {
    expect(finishKana('sarari-man', 'サラリーマン')).toBe('サラリーマン');
    expect(finishKana(' たべ ru ', 'たべる')).toBe('たべる');
    expect(finishKana('食べます', 'たべます')).toBe('食べます');
  });
});

describe('answerKey: both sides through toHiragana (SPEC §9.3)', () => {
  it('ignores the script, including in mixed words', () => {
    expect(answerKey('タベル')).toBe(answerKey('たべる'));
    expect(answerKey('こぴーする')).toBe(answerKey('コピーする'));
    expect(answerKey('コピースル')).toBe(answerKey('コピーする'));
    expect(submitted('kopi-suru', 'コピーする')).toBe(answerKey('コピーする'));
  });

  it('in katakana, ー equals the vowel it lengthens', () => {
    expect(submitted('dezaina-', 'デザイナー')).toBe(answerKey('デザイナー'));
    expect(submitted('dezainaa', 'デザイナー')).toBe(answerKey('デザイナー'));
    expect(submitted('ko-hi-', 'コーヒー')).toBe(answerKey('コーヒー'));
    expect(submitted('koohii', 'コーヒー')).toBe(answerKey('コーヒー'));
    expect(submitted('kouhii', 'コーヒー')).not.toBe(answerKey('コーヒー'));
    expect(submitted('appuro-do', 'アップロード')).toBe(answerKey('アップロード'));
    expect(submitted('appuroodo', 'アップロード')).toBe(answerKey('アップロード'));
    expect(submitted('appuroudo', 'アップロード')).not.toBe(answerKey('アップロード'));
  });

  it('compares hiragana exactly, so long vowels must be right', () => {
    expect(answerKey('とうい')).not.toBe(answerKey('とおい'));
    expect(answerKey('センセー')).not.toBe(answerKey('せんせい'));
    expect(answerKey('ソーダン')).not.toBe(answerKey('そうだん'));
    expect(submitted('toukyou', 'とうきょう')).toBe(answerKey('とうきょう'));
    expect(submitted('tookyoo', 'とうきょう')).not.toBe(answerKey('とうきょう'));
  });

  it('finishes the trailing n before comparing', () => {
    expect(submitted('kaishain', 'かいしゃいん')).toBe(answerKey('かいしゃいん'));
    expect(submitted('sarari-man', 'サラリーマン')).toBe(answerKey('サラリーマン'));
  });

  it('keeps kanji, and ignores width and spaces', () => {
    expect(answerKey('食べる')).toBe('食べる');
    expect(answerKey(' ﾀﾍﾞﾙ ')).toBe('たべる');
  });

  it('leaves a ー that lengthens nothing', () => {
    expect(answerKey('ンー')).toBe('んー');
    expect(answerKey('ー')).toBe('ー');
  });
});
