# Tangochō 単語帳 — Product spec

Working name. v1 draft, 2026-10-08. Owner: Alejandro.

This file says **what** we build; [ROADMAP.md](ROADMAP.md) says **in what order**. Sections are referenced as §n (for example §9.3). If code and spec disagree, stop and ask which one is right, then update the spec in the same pull request.

## 1. Summary

A personal web app of minigames for practicing the Japanese words I study, entered from my own paper notebook. One player, phone and computer, works offline, no account and no server.

## 2. Goals

1. Practice exactly the words I've studied, grouped the way my notebook groups them (verb groups 1–3, occupations, …).
2. Entering a notebook page takes minutes, and wrong data never gets in silently.
3. Four minigames in v1, sharing one data layer and one progress system.
4. Words I miss come back sooner (spaced repetition), and I can see what I've mastered.
5. It feels like a well-made Japanese stationery notebook, on phone and on computer.

## 3. Not in v1

- Accounts, a backend, cloud sync. **Consequence: phone and computer keep separate progress.** Moving progress between them is a manual export → import that merges (§10.1).
- Editing words inside the app. Words change only in the data files (through `/add-vocab` or by hand) and git.
- Adjective conjugation; verb forms beyond the eight in §11; honorific verbs (いらっしゃる, くださる…).
- Kanji writing, stroke order, handwriting input.
- Audio.
- Other users, sharing, leaderboards.

## 4. Platform and stack

| Concern | Choice |
|---|---|
| App | Vite + React + TypeScript (strict). Static site. |
| Hosting | GitHub Pages, deployed by GitHub Actions on every push to `main`. |
| Offline and install | PWA via vite-plugin-pwa. Fonts self-hosted with Fontsource (no font CDN at runtime). |
| Data | JSON in `data/`, bundled at build time with `import.meta.glob`. New words = commit → CI deploys. |
| Schema | Zod (`src/data/schema.ts`) plus cross-field rules (`src/data/rules.ts`), shared by the app and `npm run validate`. |
| Japanese input | WanaKana |
| Spaced repetition | ts-fsrs (FSRS, the algorithm in recent versions of Anki) |
| Storage | IndexedDB via Dexie |
| Styling | CSS Modules + design tokens as CSS custom properties (`src/styles/tokens.css`). No UI kit. |
| Routing | Hash-based (GitHub Pages has no fallback for client-side routes). |
| Tests | Vitest (unit), Playwright (e2e: desktop Chromium + mobile WebKit at iPhone size). |
| Machines | Development on Windows; CI on Linux (`ubuntu-latest`). |

Any other runtime dependency needs a one-line justification in the milestone plan.

## 5. Data

### 5.1 Words — `data/words/*.json`

Each file is an array of words. Files only organize things for humans (for example one per notebook section); the app sees one combined list.

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | Lowercase ASCII kebab-case, unique across all files. **Never changes once committed**: progress is keyed by it. Romaji of the reading as WanaKana's `toRomaji` writes it (`kyou`, `dezainaa`); noun + する verbs as `<noun>-suru` (`benkyou-suru`); a gloss for homophones (`kiru-cut`, `kiru-wear`). |
| `kanji` | string | no | Written form with kanji, as in the notebook. Omit for words written only in kana. |
| `kana` | string | yes | Full reading in hiragana and/or katakana (ー allowed). Katakana parts stay katakana (エンジニア). |
| `furigana` | `[text, reading][]` | no | Manual ruby, only when automatic placement fails (§5.4): `[["引","ひ"],["き",""],["出","だ"],["し",""]]` |
| `pos` | enum | yes | `verb`, `noun`, `i-adj`, `na-adj`, `adverb`, `phrase`, `other` |
| `verbGroup` | 1, 2 or 3 | verbs only | Required on verbs, forbidden on everything else. Comes from my notes, **never inferred from the ending**. |
| `meaning` | `{ en?: string[], es?: string[] }` | yes | At least one language with one non-empty string. A missing language is a warning; the app shows the other one. |
| `note` | `{ en?: string, es?: string }` | no | Short usage note shown in the word list. |
| `tags` | string[] | yes | Kebab-case, may be empty: `["occupations"]` |
| `added` | `YYYY-MM-DD` | yes | Date imported; powers the *New this week* deck. |
| `source` | string | no | Where it came from: `notebook-1 p.12`. |

```json
{
  "id": "kiru-wear", "kanji": "着る", "kana": "きる", "pos": "verb", "verbGroup": 2,
  "meaning": { "en": ["to wear", "to put on"], "es": ["ponerse", "llevar puesto"] },
  "note": { "en": "upper body or whole body; trousers and shoes use はく",
            "es": "torso o cuerpo entero; pantalones y zapatos usan はく" },
  "tags": [], "added": "2026-10-08", "source": "notebook-1 p.3"
}
```

Never stored, always derived: conjugations, romaji, deck membership, and furigana placement (the manual `furigana` override in §5.4 is the one exception).

### 5.2 Decks — `data/decks.json`

A deck is a named query over words, like a GameplayTag query: a word belongs to every deck it matches.

```json
{ "id": "verbs-g1",
  "name": { "en": "Verbs · Group 1", "es": "Verbos · Grupo 1", "ja": "動詞・1グループ" },
  "match": { "pos": "verb", "verbGroup": 1 } }
```

- `match` may use `pos`, `verbGroup` and `tags` (the word must have all listed tags). Every given field must match.
- `name.ja` is an optional Japanese subtitle on the deck tab.
- Built in, not in the file: *All words*, and *New this week* (`added` in the last 7 days).
- A round can use several decks; its pool is their union.

### 5.3 Verb groups

Group 1 = 五段 (u-verbs), group 2 = 一段 (ru-verbs), group 3 = irregular: する, 来る, and noun + する (勉強する). The ending can lie (帰る, 入る, 切る, 走る, 知る and 要る are group 1), which is why the group is stored.

### 5.4 Furigana

- Rendered with `<ruby>`. Placement is computed from `kanji` + `kana`: kana in the written form are fixed anchors, and each run of kanji takes the part of the reading between them. 食べる/たべる → 食(た)べる · 引き出し/ひきだし → 引(ひ)き出(だ)し · 先生/せんせい → 先生(せんせい) as one group.
- 々 and ヶ belong to the kanji run, never act as anchors: 時々 → 時々(ときどき), 一ヶ月 → 一ヶ月(いっかげつ). (WanaKana counts ヶ as kana, so the code must special-case it.)
- If placement fails or has more than one solution, validation errors and asks for a manual `furigana` field.
- Global toggle (default on) with a per-round override. Furigana is at least half the base size and never under 10 px.

### 5.5 Validation — `npm run validate`

Checks the live data (`data/words/*.json` and `data/decks.json`); `data/fixtures/` is checked as a separate set, since it repeats the sample ids. `npm run validate -- <file>` also checks a staged file against the live data (used by `/add-vocab`). Prints one line per problem with file, id and a fix hint; exits with code 1 if there are errors.

Errors:
- Invalid JSON or schema; a duplicate or malformed `id`.
- `kana` contains anything but kana and ー; `kanji` contains no kanji, or characters other than kanji, kana, ー, 々 and ヶ.
- Furigana placement fails or is ambiguous and there's no manual `furigana`; a manual `furigana` that doesn't join back into `kanji` and `kana`.
- `verbGroup` missing on a verb, or present on a non-verb.
- A verb's kana doesn't end in う く ぐ す つ ぬ ぶ む る.
- A group 2 verb that doesn't end in an い-row or え-row kana + る, or that is on the known group 1 exceptions list below (帰る labelled group 2 is the classic learner mistake).
- A group 3 verb whose kana isn't one of: ending in する, exactly くる, or ending in てくる/でくる (持ってくる). Checked on the kana, not the kanji: 出来る (できる) is group 2.
- A verb whose `kanji` doesn't end with the same kana as `kana`.
- A deck `match` that uses an unknown field.

Warnings (printed, never block):
- A group 1 verb ending in an い/え-row kana + る that isn't on the known group 1 exceptions list (帰る, 入る, 切る, 走る, 知る, 要る, 減る, 限る, 喋る, 滑る, 握る, 蹴る, 参る, 焦る, 練る, 照る, 散る, 混じる): "looks like group 2, confirm in a dictionary". The list matches kanji + kana together, as a suffix (持ち帰る counts as 帰る), so 練る (group 1) and 寝る (group 2) don't collide.
- A missing English or Spanish meaning.
- A likely duplicate: two entries with the same kanji (or both without), kana, `pos` and `verbGroup` whose meanings overlap. Same reading with a different meaning is a homophone, which is fine (いる "to exist" and いる "to need").
- A deck that matches no words.

### 5.6 Test fixtures

`data/fixtures/words.json` is a frozen copy of the sample words. Tests never read `data/words/`, so adding vocabulary can never break a test:
- Unit tests use the fixtures, or words defined inside the test for special cases (invalid entries, two words sharing a meaning).
- e2e tests run against a build that bundles the fixtures instead of `data/words/` (a Vite mode, for example `--mode e2e`).

## 6. Languages

- UI and meanings in English and Spanish, switched from the header and from Settings. Default from the browser language (`es*` → Spanish, otherwise English); the choice is remembered.
- All UI strings live in `src/i18n/en.ts` and `src/i18n/es.ts`; the type checker enforces that Spanish defines every English key.
- Every element that contains Japanese gets `lang="ja"`, so browsers use Japanese glyph shapes.

## 7. Screens

| § | Screen | Contents |
|---|---|---|
| 7.1 | Today (home) | Streak and stamp card, daily-goal progress, due count per game, a *Continue* button. |
| 7.2 | Notebook | Decks as notebook tabs → word list with furigana, meanings, verb group and note. Built first; it doubles as a data check. |
| 7.3 | Game setup | Decks (remembers the last choice), round size (10 or 20), options (furigana, direction, input mode, forms). |
| 7.4 | Play | Progress, score and combo, the question, the answer area, ◯/✕ feedback. |
| 7.5 | Results | Score, accuracy, a 新記録 stamp for a personal best, 花丸 for a perfect round, missed words with *Practice these*. |
| 7.6 | Stats | Mastery per deck, accuracy per verb group and per conjugation form, weakest words, streak calendar. |
| 7.7 | Settings | Language, furigana default, theme (system/light/dark), daily goal, new cards per day, export/import progress, reset progress (double confirmation). |

## 8. Game architecture

### 8.1 Cards and skills

A card is a (word, skill) pair with its own spaced-repetition state.

| Skill | Question | Trained by |
|---|---|---|
| `meaning` | Japanese → meaning | Quick quiz |
| `recall` | meaning → Japanese | Quick quiz (reverse), Kana typing (recall mode) |
| `reading` | kanji → reading | Kana typing (reading mode) |
| `group` | verb → group 1, 2 or 3 | Verb group sorter |
| `conjugation` | verb + form → conjugated form | Conjugation drill |

### 8.2 The round shell owns the flow; a game owns one question

`src/play/` runs every round: it builds the queue (§10.2), times answers, keeps score, shows ◯/✕ feedback and explanations, logs events and shows results. A game only renders one question and judges one answer. Games stay small and consistent, and mixed review sessions across games become possible later.

Starting shape, to be refined in the M3 plan:

```ts
// src/games/types.ts
export interface Minigame {
  id: GameId;                              // 'quiz' | 'sorter' | 'kana' | 'conjugation'
  name: Localized;                         // { en, es }
  skills: Skill[];
  eligible(word: Word, skill: Skill): boolean;
  minPool: number;                         // fewer eligible words → game disabled with a message
  Question: ComponentType<QuestionProps>;  // renders one question, calls onAnswer exactly once
}

export interface QuestionProps {
  card: Card;                              // { wordId, skill, form? }
  word: Word;
  pool: Word[];                            // all eligible words, e.g. for distractors
  options: RoundOptions;                   // furigana, direction, inputMode, forms
  onAnswer(result: AnswerResult): void;    // { correct, hinted, given, expected, explanation? }
}
```

Answer checking and distractor generation are pure functions next to each game, with unit tests.

### 8.3 Rules for every game

- Fully playable by touch alone and by keyboard alone. Keys: 1–4 choose an option, Enter submits, Enter or Space continues.
- Correct: ◯ stamp, then auto-advance after about 0.8 s. Wrong: ✕, and the correct answer and explanation stay until I continue.
- Tap targets at least 44×44 px; answer controls within thumb reach on a phone.
- Feedback is announced to screen readers (`aria-live`).

## 9. Games in v1

Each game's "Done when" line is its acceptance test.

### 9.1 Quick quiz — `meaning`, `recall`

- Forward: Japanese → four meanings in the current language. Reverse: a meaning → four Japanese options.
- Exactly one correct option, and no two options with the same displayed text. Distractors prefer the same `pos` from the selected decks, then any deck.
- Disabled, with a message, when the whole word list has fewer than four distinct meanings.

Done when: e2e answers right and wrong by keyboard (desktop) and by tap (mobile), with furigana on and off, in both directions.

### 9.2 Verb group sorter — `group`

- A verb appears; answer 1, 2 or 3 (buttons or keys).
- Each answer is followed by the rule that decides it:
  - "doesn't end in -iru/-eru → group 1"
  - "ends in -iru/-eru → group 2"
  - "する, 来る and noun + する → group 3"
  - for group 1 verbs that look like group 2: "exception: looks like group 2, but it's group 1"

Done when: e2e covers one verb of each group plus 帰る, and the exception explanation appears.

### 9.3 Kana typing — `reading`, `recall`

- Reading mode: the kanji form (furigana hidden) → type the reading. Only words with kanji.
- Recall mode: a meaning → type the word in kana. All words.
- Romaji converts as I type, into hiragana or katakana to match the expected answer; a Japanese keyboard (IME or flick input) also works.
- Submitting finishes the conversion in the expected answer's script, so a trailing n becomes ん or ン (`kaishain` → かいしゃいん; `sarari-man` → サラリーマン, not サラリーマん).
- Answers are compared after converting both sides with WanaKana's `toHiragana`. That one rule gives the behavior we want:
  - the script doesn't matter (a note appears when it's wrong), including mixed words like コピーする;
  - in katakana, ー equals the vowel it lengthens, so `dezaina-` and `dezainaa` both match デザイナー;
  - hiragana is compared exactly, so long vowels must be right: とおい ≠ とうい, and センセー ≠ せんせい.
- The exact kanji form is also accepted. In recall mode, if two words share the meaning, either counts.
- A hint reveals the first kana and marks the answer as hinted.

Done when: unit tests cover every acceptance case above; e2e types answers on desktop and on mobile.

### 9.4 Conjugation drill — `conjugation`

- A verb and a target form → produce the form.
- Forms selectable per round; default all eight (§11). Forms I miss more often come up more often.
- Input: typing (default on computer) or four choices (default on phone), switchable.
- Typing accepts kana or the kanji form (こない or 来ない).
- Choice distractors are plausible mistakes: another group's rule, or the wrong て/た sound change (書って, 書きて). Never duplicates, never a second correct answer.
- Each answer is followed by the rule: "group 1, ends in く → いて".

Done when: e2e answers in both input modes; the distractor generator is unit-tested.

## 10. Progress

### 10.1 Event log

- Every answer appends an `AnswerEvent { id, at, roundId, game, wordId, skill, form?, correct, hinted, ms, device }`; every finished round appends a `RoundEvent { id, at, game, deckIds, size, score, correct, total }`.
- Events are append-only, in IndexedDB. Spaced-repetition state, scores, streaks and mastery are derived from them (cached for speed, always rebuildable).
- Export saves the event log as a JSON file. Import merges by event id (importing the same file twice changes nothing) and rebuilds. This is how progress moves between phone and computer in v1.
- Ask for persistent storage (`navigator.storage.persist()`). Browsers may clear data for sites that haven't been used in a while, Safari on iPhone especially, so install the app on the phone; Settings shows the last export date and reminds me after 7 days.

### 10.2 Spaced repetition

- FSRS via ts-fsrs, default parameters.
- Answer → rating: wrong → *Again*; correct with a hint → *Hard*; correct → *Good*. *Easy* is never inferred.
- Round queue: due cards first (most overdue first), then new cards (daily limit, default 15, shared by all games), then, if the round still isn't full, the least recently seen cards as extra practice.
- Cards whose word was removed from the data are ignored, not deleted.

### 10.3 Scores

- A correct answer earns 100 × combo multiplier (starts at 1.0, +0.1 per consecutive correct answer, max 2.0). A hinted answer earns half. A wrong answer earns 0 and resets the combo.
- Personal best per (game, deck selection, round size); beating it shows a 新記録 stamp.

### 10.4 Daily goal and streak

- Daily goal: a number of answers (default 20; options 10, 20, 50).
- The day starts at 04:00 local time, so practice at 1 a.m. counts for the previous day.
- Streak = consecutive days with the goal met. Stamp card calendar: a hanko stamp for each goal day, 花丸 for days with a perfect round.

### 10.5 Mastery

- From FSRS stability: *New* (never seen), *Learning* (under 3 days), *Familiar* (3 to 21 days), *Mastered* (21 days or more).
- Stats: % mastered per deck, accuracy per verb group and per conjugation form, and the 10 weakest words (most lapses) with *Practice these*.

## 11. Conjugation engine — `src/lib/conjugate.ts`

- Pure function `conjugate(word, form) → { kanji?, kana }`. It applies the rules to the kana and rewrites the ending of both forms.
- Forms in v1: dictionary, ます, ません, ました, ませんでした, て, ない, た.
- Group 2: drop る and add the ending (食べる → 食べます, 食べて, 食べない, 食べた).
- Group 1:
  - ます forms: the final kana moves from the う-row to the い-row (書く → 書きます).
  - ない: the final kana moves to the あ-row, + ない, with う → わ (書く → 書かない, 買う → 買わない).
  - て and た: う・つ・る → って/った; む・ぶ・ぬ → んで/んだ; く → いて/いた; ぐ → いで/いだ; す → して/した.
- Group 3: する → します, して, しない, した…; noun + する keeps the noun (勉強します). 来る keeps its kanji but changes its reading: 来ます (きます), 来て (きて), 来ない (こない), 来た (きた). Verbs ending in てくる/でくる conjugate like 来る (持ってくる → 持ってきます, 持ってこない).
- Exceptions: 行く → 行って, 行った, and so do verbs ending in ていく/でいく (持っていく → 持っていって). ある → ない.
- **Test-first.** `src/lib/conjugate.test.ts` is a table of (verb, form, expected kanji, expected kana) covering every group 1 ending, both exceptions, 来る, する, a noun + する verb, 持っていく and 持ってくる, and the homophones 切る (group 1) and 着る (group 2). I check every row against a reliable conjugation chart before the engine exists; after that, the agent never edits the table.

## 12. Importing from the paper notebook — `/add-vocab`

- Photos of notebook pages go in `inbox/` (git-ignored) or are attached to the session.
- The skill in `.claude/skills/add-vocab/SKILL.md` transcribes, normalizes to §5.1, runs the validator on a staged file and shows a review table. Nothing is written to `data/` until I approve.
- The notebook is the input, not the authority. Unclear handwriting, likely notebook mistakes, and anything the agent supplied (a translated meaning, a dictionary form converted from ます form, a kanji my notes didn't have) are flagged in the table for me to decide.
- After v1: cross-check every entry against JMdict, the free dictionary data behind Jisho (the kanji + kana pair exists, and its verb class matches `verbGroup`).

## 13. Look and feel — Japanese stationery

- **Paper**: warm off-white with a subtle grain, ruled lines on cards, washi-tape headers, decks as notebook tabs.
- **Ink**: near-black sumi for text, indigo for accents, vermilion (朱) for the ◯ stamp; on Japanese tests a red ◯ marks a correct answer. Color is never the only signal: the ◯ and ✕ shapes carry the meaning.
- **Feedback**: a hanko-style stamp (slight rotation, ink spread); 花丸 for a perfect round. All motion is off under `prefers-reduced-motion`.
- **Type**: Japanese prompts in a pen-written face close to textbook glyphs, so learners see real stroke shapes (Klee One). UI in a clean sans with Japanese coverage (Zen Kaku Gothic New). Chosen in M1 from screenshots, against Zen Kurenaido and Yomogi for prompts and BIZ UDPGothic and Zen Maru Gothic for the UI.
- **Dark mode**: "night notebook", deep indigo paper and light ink. Follows the system, with an override in Settings.
- Text contrast meets WCAG AA; focus rings are always visible.
- Components never hard-code colors or sizes; everything comes from `src/styles/tokens.css`.

Starting tokens, adjusted in M1 from screenshots. Every text color passes AA (4.5:1) on both `--paper` and `--card`.

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#F6F1E7` | `#171C27` |
| `--card` | `#FBF8F2` | `#1F2533` |
| `--rule` | `#E3DBCB` | `#2E3546` |
| `--ink` | `#24211D` | `#ECE5D8` |
| `--ink-soft` | `#6B645A` | `#A9A293` |
| `--ai` (indigo) | `#2F4B6E` | `#8FA8CC` |
| `--shu` (vermilion) | `#B8392A` | `#E36A55` |

## 14. Quality

- `npm run check`: typecheck, lint, unit tests, data validation. Must pass before anything is called done.
- `npm run e2e`: Playwright on desktop Chromium and mobile WebKit (iPhone viewport).
- `npm run shots`: screenshots of every screen at 390×844 and 1280×800, light and dark, saved to `shots/` (git-ignored), for reviewing the look.
- CI on every pull request: check, e2e, build. Deploy to Pages on `main`.
- **Definition of done** for any milestone: its "Done when" items pass; evidence shown (command output, screenshots); I tried it myself, on the phone once it's deployed; ROADMAP boxes ticked and SPEC updated if behavior changed; merged to `main`.

## 15. Open questions

- The final name (Tangochō is a working title).
- Syncing progress between devices after v1. The event log turns it into syncing one append-only file (a private gist or a small backend).
- A pronunciation button using the browser's speech synthesis (voice quality varies by device).
