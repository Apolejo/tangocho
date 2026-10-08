# Tangochō 単語帳

Minigames for drilling the Japanese vocabulary from my own notebook (a quick quiz, a verb group sorter, kana typing and a conjugation drill), with spaced repetition. Works on phone and computer, and offline.

- Live: https://apolejo.github.io/tangocho/
- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Roadmap and status: [docs/ROADMAP.md](docs/ROADMAP.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)

Status: M1, the walking skeleton. The notebook screen shows the sample decks; the games arrive from M3.

## Run it

Needs Node 24 or newer (the scripts in `scripts/` are TypeScript that Node runs natively).

```bash
npm install
npm run dev
```

Open http://localhost:5173/tangocho/ (the `/tangocho/` path matches the GitHub Pages URL). To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the address it prints.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, lint (ESLint + Prettier), unit tests (Vitest) and data validation. Must pass before anything is called done. |
| `npm run e2e` | Playwright on desktop Chromium and mobile WebKit (iPhone size), against a build that bundles the test fixtures. Run `npx playwright install chromium webkit` once first. |
| `npm run validate` | Checks `data/words/*.json` and `data/decks.json`, then `data/fixtures/` as a separate set. `npm run validate -- <file>` checks a staged file against the live words. |
| `npm run shots` | Screenshots of every screen at phone and desktop size, light and dark, into `shots/`. |
| `npm run build`, `npm run preview` | Production build into `dist/`, and a local server for it. |
| `npm run format` | Prettier over the whole repo. |

## Where things live

- `data/words/*.json`: the vocabulary (SPEC §5.1). Files only organize things for humans; the app sees one list. `data/decks.json`: decks as queries over words (§5.2).
- `data/fixtures/words.json`: a frozen copy of the sample words. Tests never read `data/words/`, so adding vocabulary can't break a test.
- `src/data/`: the Zod schema, the §5.5 rules and the deck queries, shared by the app and the validator.
- `src/lib/`: pure helpers such as furigana placement.
- `src/i18n/`: every UI string, in English and Spanish.
- `src/styles/tokens.css`: every color and size.
- `scripts/`: the validator and the screenshot script.

## Deploy

Every push to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run `check`, `e2e` and `build` (`.github/workflows/ci.yml`).
