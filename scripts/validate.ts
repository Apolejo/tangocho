/**
 * `npm run validate`: checks data/words/*.json and data/decks.json, then data/fixtures/ as a
 * separate set (SPEC §5.5). `npm run validate -- <file>` checks one staged file against the
 * live words instead. One line per problem; exit code 1 if there are errors.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';
import { checkDecks, checkWords, type Located, type Problem } from '../src/data/rules.ts';
import { DeckSchema, WordSchema, type Deck, type Word } from '../src/data/schema.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface Loaded<T> {
  items: Located<T>[];
  problems: Problem[];
}

function readJson(file: string, absolute: string): { value: unknown } | { problem: Problem } {
  let source: string;
  try {
    source = readFileSync(absolute, 'utf8');
  } catch (e) {
    return {
      problem: { level: 'error', code: 'file', file, message: `cannot read: ${String(e)}` },
    };
  }
  try {
    return { value: JSON.parse(source) as unknown };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      problem: {
        level: 'error',
        code: 'json',
        file,
        message: `invalid JSON: ${message}`,
        hint: 'check commas, quotes and brackets',
      },
    };
  }
}

function idOf(raw: unknown): string | undefined {
  if (typeof raw === 'object' && raw !== null && 'id' in raw && typeof raw.id === 'string') {
    return raw.id;
  }
  return undefined;
}

/** Parses every item of a JSON array file on its own, so one bad entry doesn't hide the rest. */
function loadItems<T>(file: string, absolute: string, schema: ZodType<T>, what: string): Loaded<T> {
  const read = readJson(file, absolute);
  if ('problem' in read) return { items: [], problems: [read.problem] };
  if (!Array.isArray(read.value)) {
    return {
      items: [],
      problems: [
        { level: 'error', code: 'schema', file, message: `must be a JSON array of ${what}` },
      ],
    };
  }
  const items: Located<T>[] = [];
  const problems: Problem[] = [];
  read.value.forEach((raw: unknown, index) => {
    const result = schema.safeParse(raw);
    if (result.success) {
      items.push({ value: result.data, file });
      return;
    }
    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join('.');
      problems.push({
        level: 'error',
        code: 'schema',
        file,
        id: idOf(raw) ?? `#${index}`,
        message: `${path === '' ? what.replace(/s$/, '') : path}: ${issue.message}`,
      });
    }
  });
  return { items, problems };
}

/** A missing directory counts as no files: git does not keep empty folders. */
function wordFiles(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `${dir}/${name}`);
}

interface DataSet {
  words: Located<Word>[];
  decks: Located<Deck>[];
  problems: Problem[];
}

function loadSet(dir: string): DataSet {
  const loaded = wordFiles(dir).map((file) =>
    loadItems(file, join(ROOT, file), WordSchema, 'words'),
  );
  const decks = loadItems('data/decks.json', join(ROOT, 'data/decks.json'), DeckSchema, 'decks');
  return {
    words: loaded.flatMap((l) => l.items),
    decks: decks.items,
    problems: [...loaded.flatMap((l) => l.problems), ...decks.problems],
  };
}

function checkSet(set: DataSet): Problem[] {
  return [
    ...set.problems,
    ...checkWords(set.words),
    ...checkDecks(
      set.decks,
      set.words.map((w) => w.value),
    ),
  ];
}

/** Prints the problems of one set and returns how many were errors. */
function report(title: string, problems: Problem[], counts: string): number {
  const errors = problems.filter((p) => p.level === 'error').length;
  const warnings = problems.length - errors;
  console.log(`\n${title}`);
  for (const p of problems) {
    const icon = p.level === 'error' ? '✖' : '⚠';
    const where = p.id === undefined ? p.file : `${p.file} · ${p.id}`;
    const hint = p.hint === undefined ? '' : ` → ${p.hint}`;
    console.log(`  ${icon} ${where} · ${p.message}${hint}`);
  }
  const status = errors > 0 ? '✖' : '✓';
  console.log(`  ${status} ${counts}: ${errors} errors, ${warnings} warnings`);
  return errors;
}

function main(argv: string[]): number {
  const staged = argv[0];
  const live = loadSet('data/words');
  const liveCounts = `${live.words.length} words, ${live.decks.length} decks`;

  if (staged !== undefined) {
    const file = staged.replace(/\\/g, '/');
    const loaded = loadItems(file, resolve(process.cwd(), staged), WordSchema, 'words');
    const problems = [...loaded.problems, ...checkWords(loaded.items, live.words)];
    return report(
      `${file} against data/words (${liveCounts})`,
      problems,
      `${loaded.items.length} words`,
    );
  }

  let errors = report('data/words + data/decks.json', checkSet(live), liveCounts);
  const fixtures = loadSet('data/fixtures');
  errors += report(
    'data/fixtures (separate set)',
    checkSet(fixtures),
    `${fixtures.words.length} words, ${fixtures.decks.length} decks`,
  );
  return errors;
}

process.exitCode = main(process.argv.slice(2)) > 0 ? 1 : 0;
