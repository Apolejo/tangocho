# Tangochō — Roadmap

One milestone at a time, in order. Each milestone is one branch and one pull request. Tick the boxes as you go; [SPEC.md](SPEC.md) says what each item means.

## How every milestone runs

1. **Start clean.** A new session in the Code tab (in the terminal: `/clear`), on an up-to-date `main`. Create the milestone branch, for example `m1-skeleton` (Claude can do it).
2. **Plan.** Switch the mode selector to **Plan** (in the terminal: press Shift+Tab until the status bar shows plan mode) and paste the kickoff prompt below with the milestone number.
3. **Review the plan before any code exists.** Ask about anything you don't understand and cut anything you didn't ask for. Then approve it and switch to **Accept edits**, or **Manual** for your first few milestones so you see every step.
4. **Build.** Claude implements, runs the checks and shows evidence: command output and screenshots.
5. **Review.** Read the diff (comment on lines in the diff view and Claude revises), then click **Review code** (in the terminal: `/code-review`). Fix real problems only; a reviewer asked to find issues always finds some.
6. **Try it yourself** in the Browser pane. To try it on your phone before merging, run `npm run dev -- --host` and open the address it prints on the phone (same Wi-Fi).
7. **Ship.** Commit, push, open the pull request, merge when CI is green, then check the live site on your phone. Tick the boxes here and update SPEC if behavior changed.
8. **Two-minute retro.** Did Claude repeat a mistake? Add one line to CLAUDE.md, or turn it into a hook if it must never happen again.

Kickoff prompt (change the milestone):

```text
We're starting milestone M1 from docs/ROADMAP.md.
Read CLAUDE.md, the M1 section of docs/ROADMAP.md and the SPEC sections it lists.
Interview me with AskUserQuestion about anything the spec leaves open or that looks wrong to you.
Then write the plan: the files you'll create or change, the tests you'll add, and exactly how
you'll prove each "Done when" item (commands, screenshots). Don't write code until I approve it.
```

When a session goes sideways, correct it once. If the same problem survives two corrections, start a new session with a better prompt that includes what you learned. Commit whenever the checks are green; git is your undo.

---

## M0 — Setup (you, about an hour)

- [ ] Install Git for Windows, Node.js LTS and the GitHub CLI; run `gh auth login`.
- [ ] Choose the repo's visibility. GitHub Pages is free for public repos; private repos need GitHub Pro. The published site is public either way. For a public repo, commit with your GitHub no-reply email.
- [ ] Create the repo, clone it, copy in the starter files (including `.claude/`, `.gitignore` and `.gitattributes`), commit and push.
- [ ] Read SPEC.md and this roadmap end to end. Fix anything that's wrong or that you don't want; it's your spec now.
- [ ] Open the repo folder in the Code tab and ask: "Which files may you never edit to make a test pass?"

Done when: the repo is on GitHub with the starter files, and Claude answers that question from CLAUDE.md without opening any file.

## M1 — Walking skeleton · SPEC §4, §5, §6, §7.2, §13, §14

Goal: the whole pipeline (data → validation → a screen on your phone) working before any game exists.

- [x] Scaffold Vite + React + TypeScript (strict) in a temporary folder and move it in. Never let the scaffolder delete existing files.
- [x] Zod schema, the §5.5 rules and `npm run validate`, with a unit test for every rule.
- [x] Copy `data/words/sample.json` to `data/fixtures/words.json`. Unit tests use the fixtures or words defined in the test; e2e runs against a fixtures build (SPEC §5.6).
- [x] Furigana placement (`src/lib/furigana.ts`), unit-tested on every sample word.
- [x] English/Spanish UI with the language toggle.
- [x] Design tokens and the base stationery look; `npm run shots`; choose the fonts with me from screenshots.
- [x] Notebook screen: deck tabs → word list with furigana and meanings.
- [x] Hash routing; Vite `base` set to the repo name.
- [x] npm scripts named exactly as in CLAUDE.md. ESLint and Prettier. Playwright with desktop and mobile projects and one smoke test.
- [x] Set up the app preview so Claude can check its own UI changes.
- [x] GitHub Actions: CI on pull requests; deploy to GitHub Pages on `main`.
- [x] README: what it is and how to run it.

Done when: `npm run check` and `npm run e2e` pass locally and in CI; the Pages URL shows the notebook with the sample decks on your phone; a word with a broken field makes `npm run validate` fail with a clear message.

## M2 — Import pipeline · SPEC §12, §5.5

Goal: your notebook in the app, safely.

- [x] Delete `data/words/sample.json` first (the fixtures keep a copy), so your own words never collide with sample words.
- [x] Review `.claude/skills/add-vocab/SKILL.md` against the real validator and adjust it.
- [x] Ask Claude for a hook that runs `npm run validate` after any edit in `data/` and exits with code 2 when validation fails. With code 2 the report goes back to Claude; with code 1 you'd only see a notice.
- [x] Import one real notebook page with `/add-vocab notebook-1 p.1`; decide every flag yourself; commit.
- [x] Import the rest of the notebook, a few pages per session.

Done when: your own words are live on the phone; you decided every flagged item; the hook catches a deliberately broken data edit.

## M3 — Quick quiz and the round shell · SPEC §7.3–7.5, §8, §9.1, §10.1, §10.3

Goal: the first complete game, and the architecture every other game reuses.

- [ ] The `Minigame` interface and the round shell: queue, timing, score and combo, ◯/✕ feedback.
- [ ] Game setup, play and results screens.
- [ ] Round queue: shuffled for now; the spaced-repetition order (§10.2) arrives in M8.
- [ ] Event log in IndexedDB; personal bests.
- [ ] Quick quiz in both directions.

Done when: §9.1 passes; every answer appends an event; personal bests survive a reload.

## M4 — Verb group sorter · SPEC §9.2

- [ ] The game with its rule explanations, using the round shell from M3 unchanged (if the shell needs a change, the plan says why).

Done when: §9.2 passes.

## M5 — Kana typing · SPEC §9.3

- [ ] Answer normalization first, as a pure function with unit tests; then the game.

Done when: §9.3 passes, including with your phone's keyboard.

## M6 — Conjugation engine, test-first · SPEC §11

- [ ] Session 1: Claude writes `src/lib/conjugate.test.ts` only. No engine yet.
- [ ] **You** check every row against a reliable conjugation chart (a textbook table, or a dictionary's conjugation tables), fix anything wrong and commit the table.
- [ ] Session 2, a new session: implement `src/lib/conjugate.ts` until the table passes, without touching the table.

Done when: the whole table passes and you've checked every row yourself.

## M7 — Conjugation drill · SPEC §9.4

- [ ] Verb inspection in the notebook: tap a verb → its eight forms (§7.2).

Done when: §9.4 passes and a tapped verb shows its forms.

## M8 — Progress · SPEC §10, §7.1, §7.6, §7.7

- [ ] FSRS from the event log; round queue with due and new cards.
- [ ] Today screen; daily goal and streak with the 04:00 day boundary; stamp card.
- [ ] Stats screen with mastery levels.
- [ ] Settings screen, including reset progress.
- [ ] Export and import that merges; persistent storage; export reminder.

Done when: unit tests cover the rating mapping, the 04:00 boundary, the mastery thresholds and importing the same file twice; progress exported from the phone merges into the computer.

## M9 — Stationery polish and offline · SPEC §13, §4

- [ ] Stamp and 花丸 animations (off under reduced motion); dark mode, with the theme option in Settings.
- [ ] PWA install and offline use; self-hosted fonts.
- [ ] Accessibility pass: a keyboard-only round, contrast, tap targets.

Done when: installed on your phone, it works in airplane mode; you've reviewed light and dark screenshots; a full round works by keyboard alone.

---

## After v1 (ideas, not promises)

- JMdict cross-check in the validator.
- Sync progress between devices.
- Pronunciation button.
- More games: matching pairs, listening.
- Adjective conjugation.
- Mixed daily review across games.
- Run `/add-vocab` from your phone with Claude Code in the cloud → pull request → automatic deploy.
- Deploy to the Oracle server too (a second static target), or use it for the sync backend.
