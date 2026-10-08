# Tangochō 単語帳

Personal web app of minigames for drilling the Japanese words in my own notebook.
- What we build: docs/SPEC.md (§9.3 means section 9.3). Read the relevant sections before planning.
- Order and status: docs/ROADMAP.md. One milestone at a time.

## Commands
- `npm run dev`: dev server
- `npm run check`: typecheck, lint, unit tests, data validation. Must pass before you call anything done.
- `npm run e2e`: Playwright, desktop Chromium + mobile WebKit
- `npm run validate`: data only; run after any change in data/
- `npm run shots`: phone and desktop screenshots of every screen, into shots/

## Architecture
- Words live only in data/words/*.json and must pass src/data/schema.ts and src/data/rules.ts. Never hardcode words in components.
- Tests never read data/words/, so new vocabulary can't break a test. Unit tests use data/fixtures/ or words defined in the test; e2e runs against a build that bundles the fixtures.
- Decks are queries over words (data/decks.json), not lists of ids.
- Conjugations, romaji and furigana placement are derived at runtime, never stored (the one exception: the manual furigana override, SPEC §5.4).
- verbGroup comes from the data. Never infer it from the word's ending.
- The round shell (src/play/) owns flow, scoring, feedback and logging; a game (src/games/<id>/) renders one question and judges one answer.
- Progress is an append-only event log in IndexedDB; SRS state, scores and streaks are derived from it.
- All UI text goes through src/i18n (en + es). Elements that contain Japanese get lang="ja".
- Colors and sizes come from src/styles/tokens.css.

## Rules
- IMPORTANT: never edit src/lib/conjugate.test.ts or data/fixtures/ to make a test pass. Stop and tell me.
- Never change an existing word id; progress is keyed by it.
- A new runtime dependency needs a one-line justification in the plan.
- When you finish, show evidence: the check output, plus screenshots for UI changes.
- One branch per milestone (m3-quiz). Commit prefixes: feat:, fix:, test:, docs:, vocab:.

## Gotchas
- I develop on Windows and CI runs Linux: keep npm scripts cross-platform (Node scripts, no `rm -rf`, no inline env vars), and match file-name case exactly in imports.
- GitHub Pages serves the site from /<repo-name>/: Vite `base` must match, and routing is hash-based.
- WanaKana: on submit, convert the input once more in the expected answer's script (toKatakana for katakana answers), or a trailing "n" becomes ん inside a katakana word.
- WanaKana counts ヶ as kana; for furigana placement it belongs to the kanji run, like 々.
