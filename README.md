# Tangochō 単語帳

Minigames for drilling the Japanese vocabulary from my own notebook (a quick quiz, a verb group sorter, kana typing and a conjugation drill), with spaced repetition. Works on phone and computer, and offline.

- Live: https://apolejo.github.io/tangocho/
- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Roadmap and status: [docs/ROADMAP.md](docs/ROADMAP.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)

Status: M9 done, the last v1 milestone. The notebook holds every word from my paper notebook (1,175), imported with `/add-vocab`; tapping a verb shows its eight forms. Four games are playable: the quick quiz, the verb group sorter, kana typing and the conjugation drill. Every answer goes into a progress log in IndexedDB; spaced repetition (FSRS), personal bests, the daily goal and streak, and mastery are derived from it. Today (home) shows the streak, the stamp card and each game's due cards, with *Continue*; Stats shows mastery per deck and the weakest words; Settings exports and imports progress, which is how it moves between phone and computer. A ⚑ on any word opens a prefilled GitHub issue to report a mistake, and the app shows how many are open. It installs on the phone's home screen and works in airplane mode; it has a night-notebook theme, stamps that press onto the paper, and a round plays by keyboard alone.

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
| `npm run build`, `npm run preview` | Production build into `dist/`, and a local server for it at http://localhost:4173/tangocho/. The dev server has no service worker; this is where to try offline (DevTools → Network → Offline, then reload). |
| `npm run icons` | Renders `public/icon.svg` into the app's icons in `public/`. Commit the PNGs. |
| `npm run format` | Prettier over the whole repo. |

## Where things live

- `data/words/*.json`: the vocabulary (SPEC §5.1). Files only organize things for humans; the app sees one list. `data/decks.json`: decks as queries over words (§5.2).
- `data/fixtures/words.json`: a frozen copy of the sample words. Tests never read `data/words/`, so adding vocabulary can't break a test.
- `src/data/`: the Zod schema, the §5.5 rules and the deck queries, shared by the app and the validator.
- `src/lib/`: pure helpers such as furigana placement.
- `src/games/`: the `Minigame` interface and one folder per game; a game renders one question and judges one answer (SPEC §8.2).
- `src/play/`: the round shell, shared by every game: setup, queue, scoring, ◯/✕ feedback, logging and results.
- `src/progress/`: the append-only event log in IndexedDB (Dexie) and what's derived from it, such as personal bests (§10).
- `src/i18n/`: every UI string, in English and Spanish.
- `src/styles/tokens.css`: every color and size.
- `scripts/`: the validator, the screenshot script, the icon renderer, and the font slices the service worker precaches (used by `vite.config.ts`).

## Install it on the iPhone

1. Open https://apolejo.github.io/tangocho/ in Safari, then Share → Add to Home Screen.
2. Open the app from the home screen once while online. Settings → Offline says when everything is saved on the phone.
3. The home-screen app keeps its own storage, separate from Safari's: if you played in Safari, export there (Settings → Export progress) and import the file in the app.
4. From then on it works in airplane mode. When a new version is deployed (new words included), a banner offers *Reload*; it never shows during a round.

## Add vocabulary

Pages of the notebook (photos or PDFs) go in `inbox/`, which git ignores. In Claude Code, `/add-vocab <source label> [file.json]` transcribes them, validates the result against the live data and shows a review table; nothing reaches `data/` until I approve every flagged item (SPEC §12). A hook in `.claude/settings.json` runs the validator after every edit in `data/`, so a broken entry is reported back immediately.

## Deploy

Every push to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run `check`, `e2e` and `build` (`.github/workflows/ci.yml`).
