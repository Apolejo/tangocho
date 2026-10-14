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
| `kanji` | string | no | Written form with kanji, as in the notebook. Omit for words written only in kana. Verbs in dictionary form (買う, not 買います): the validator and the games need it, and the app shows the ます form (§7.2). |
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

Never stored, always derived: conjugations (including the ます form the app displays), romaji, deck membership, and furigana placement (the manual `furigana` override in §5.4 is the one exception).

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
- Global toggle in Settings (default on) with a per-round override: changing it sets furigana in every game's remembered setup and in setups not made yet, and a game's setup can still override it for that game until the global toggle changes again. The notebook always shows furigana; it's the reference. Furigana is at least half the base size and never under 10 px.

### 5.5 Validation — `npm run validate`

Checks the live data (`data/words/*.json` and `data/decks.json`); `data/fixtures/` is checked as a separate set, since it repeats the sample ids. `npm run validate -- <file>` also checks a staged file against the live data (used by `/add-vocab`). Prints one line per problem with file, id and a fix hint; exits with code 1 if there are errors.

Errors:
- Invalid JSON or schema; a duplicate or malformed `id`.
- `kana` contains anything but kana and ー; `kanji` contains no kanji, or characters other than kanji, kana, ー, 々 and ヶ.
- Furigana placement fails or is ambiguous and there's no manual `furigana`; a manual `furigana` that doesn't join back into `kanji` and `kana`.
- `verbGroup` missing on a verb, or present on a non-verb.
- A verb's kana doesn't end in う く ぐ す つ ぬ ぶ む る.
- A group 2 verb that doesn't end in an い-row or え-row kana + る, or that is on the known group 1 exceptions list below (帰る labelled group 2 is the classic learner mistake).
- A group 3 verb whose kana isn't one of: ending in する, exactly くる, or ending in てくる/でくる (持ってくる) or にくる (迎えに来る). Checked on the kana, not the kanji: 出来る (できる) is group 2.
- A verb whose `kanji` doesn't end with the same kana as `kana`.
- A verb that passes every rule above but that the conjugation engine (§11) still can't conjugate, such as 為る written for する. Reported only when no other error is, so it never repeats one.
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

### 5.7 Reporting a mistake

The words come from my handwritten notes, so some will be wrong. Reports go to GitHub, next to the data they fix.
- A small ⚑ button on every word in the notebook (including each of a verb's forms, §7.2), on the missed words in Results, and in every game's answer feedback. It opens a prefilled new issue on the repo in a new tab (`issues/new?labels=word-report&title=…&body=…`), with the word id, the word as the app shows it with its reading, its meaning, the conjugation form and the app's answer (if any), where the report was made, the notebook page (`source`) and a line for what looks wrong. Nothing is sent until I submit the issue on GitHub.
- At launch, when online, the app asks GitHub's public API how many `word-report` issues are open (`GET /repos/Apolejo/tangocho/issues?labels=word-report&state=open`; pull requests don't count) and shows a small banner ("2 open word reports") that links to them, on Today, the notebook and the game list, never during a round. ✕ hides it until the next launch. Offline, with none open, or if the request fails or takes over 5 s, nothing shows. It's the app's only request to another site, and it never blocks anything. e2e answers the API itself, so tests never reach GitHub.
- Fixing happens in a Claude session ("fix the open word reports"): Claude reads them with `gh`, shows each proposed change for me to decide, as `/add-vocab` does, commits with `vocab:` and closes the issue. A wrong id is never fixed by renaming it (§5.1).
- The repo is public, so reports are public; they contain only words.

## 6. Languages

- UI and meanings in English and Spanish, switched from the header and from Settings. Default from the browser language (`es*` → Spanish, otherwise English); the choice is remembered.
- All UI strings live in `src/i18n/en.ts` and `src/i18n/es.ts`; the type checker enforces that Spanish defines every English key.
- Every element that contains Japanese gets `lang="ja"`, so browsers use Japanese glyph shapes.

## 7. Screens

| § | Screen | Contents |
|---|---|---|
| 7.1 | Today (home) | Streak and this month's stamp card (§10.4), daily-goal progress, and each game with its due count, counted over the game's remembered setup (its decks and options), linking to its setup. *Continue* starts a round at once in the game with the most due cards, with its remembered setup; with nothing due, the last game played (or the first available one). A small banner reminds me to export once 7 days have passed since the last export, or since the first answer if I never exported, as long as there is progress the last export doesn't have (§10.1); it links to Settings, and ✕ hides it until the next launch. |
| 7.2 | Notebook | Decks as notebook tabs → word list with furigana, meanings, verb group and note. Verbs are shown in ます form, derived from the stored dictionary form (§5.1, §11); tapping a verb opens its eight forms with furigana, each with its ⚑ (§5.7): a bottom sheet on a phone, a dialog on the computer (✕, Esc or a tap outside closes it). Built first; it doubles as a data check. |
| 7.3 | Game setup | Decks (remembers the last choice; the counts are of the words the game can use, so verbs only for the sorter), round size (10 or 20), options (furigana, direction, kana typing mode, input mode, forms). |
| 7.4 | Play | Progress, score and combo, the question, the answer area, ◯/✕ feedback. |
| 7.5 | Results | Score, accuracy, a 新記録 stamp for a personal best, 花丸 for a perfect round, missed words with *Practice these*. |
| 7.6 | Stats | Mastery per deck (§10.5) as a New/Learning/Familiar/Mastered bar with a legend and the % mastered; accuracy per verb group (sorter and drill side by side) and per conjugation form; the weakest words per game, each list with *Practice these*; the stamp card as a streak calendar, month by month, with the current and longest streak. |
| 7.7 | Settings | Language, furigana default (§5.4), daily goal (10, 20 or 50; §10.4), new cards per day (5, 10, 15, 20 or 30), export/import progress with the last export date (§10.1), whether storage is persistent, reset progress (two confirmations; it deletes the event log and keeps the settings). The theme option (system/light/dark) arrives with dark mode in M9. |

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

The shape, as built in M3:

```ts
// src/games/types.ts
export interface Minigame {
  id: GameId;                              // 'quiz' | 'sorter' | 'kana' | 'conjugation'
  nameKey: MessageKey;                     // UI text lives in src/i18n
  nameJa: string;                          // Japanese subtitle on the game card
  descriptionKey: MessageKey;
  skills: Skill[];
  options: OptionKey[];                    // setup controls: 'furigana', 'direction', 'mode', 'inputMode', 'forms'
  skillsFor(options): Skill[];             // the skills a round trains; the queue picks one per card
  variant(options): string;                // the game's part of the personal-best key (§10.3)
  eligible(word: Word, skill: Skill): boolean;
  formsFor?(word, options): string[];      // a card's possible forms (the drill); the queue picks one
  minPool: number;                         // fewer eligible words → game disabled with a message
  available(allWords, lang): boolean;      // a game-specific check, explained by unavailableKey
  unavailableKey: MessageKey;
  Question: ComponentType<QuestionProps>;  // renders one question, calls onAnswer exactly once
}

export interface QuestionProps {
  card: Card;                              // { wordId, skill, form? }
  word: Word;
  pool: Word[];                            // all eligible words of the selected decks, e.g. for distractors
  allWords: Word[];                        // every word, for when the decks alone aren't enough
  options: RoundOptions;                   // furigana, direction, mode, inputMode, forms
  seed: number;                            // seeds the question's randomness, so rendering stays pure
  onAnswer(result: AnswerResult): void;    // { correct, hinted, given, expected, expectedLang?, explanation?, reveals? }
}
```

`explanation` is a React node, not a string, so the Japanese it quotes can carry `lang="ja"` (§6).

The round queue picks its cards in the §10.2 order, then shuffles them: each word at most once, round size = min(10 or 20, pool). A game with `formsFor` gets one form per card, drawn toward the forms missed more often (§9.4). *Practice these* replays the missed cards, each with its skill and form; from Stats (§7.6) it replays the weakest cards, and a card without a form gets one drawn as above. *Quit* goes back to setup; answers already given stay logged, and no round event is written.

Answer checking and distractor generation are pure functions next to each game, with unit tests.

### 8.3 Rules for every game

- Fully playable by touch alone and by keyboard alone. Keys: 1–4 choose an option, Enter submits, Enter or Space continues.
- Correct: ◯ stamp, then auto-advance after about 0.8 s. When the game gives a rule (§9.2, §9.4) or reveals something to read (the meaning in §9.3, flagged by `reveals`), the answer stays about 2.5 s, or until Enter, Space or *Continue*. Wrong: ✕, and the correct answer and explanation stay until I continue.
- A right answer typed into a field leaves the focus there, so a phone keeps its keyboard up between questions, and Enter in the field continues. After a wrong answer the focus moves to *Continue* (the keyboard goes down, so the answer can be read).
- Tap targets at least 44×44 px; answer controls within thumb reach on a phone.
- Feedback is announced to screen readers (`aria-live`).
- Tapping the question's word shows its meaning in a small bubble beside it (above it when there's no room beside, below when there's none above), in the games whose question isn't about the meaning: the sorter, kana typing's reading mode and the drill. The quiz and kana recall don't offer it, since there the meaning is the question or the prompt. Looking never counts as a hint, and a typed answer's field keeps its focus. A tap on the word again, anywhere else, or Esc closes it. By keyboard, the word is a button.
- Verbs are shown in ます form, like the notebook (§7.2), except a drill question that asks for the ます form, which shows the dictionary form (§9.4); explanations that depend on the ending (§9.2, §9.4) quote the dictionary form.

## 9. Games in v1

Each game's "Done when" line is its acceptance test.

### 9.1 Quick quiz — `meaning`, `recall`

- Forward: Japanese → four meanings in the current language (every gloss, joined as in the notebook). Reverse: a meaning → four Japanese options. Mixed: a direction per question.
- Exactly one correct option, and no two options with the same displayed text. A distractor never shares a gloss with the answer in either language (parenthesized details ignored: "tomar (fotos)" counts as "tomar"), and never looks the same in Japanese. Distractors prefer the same `pos` from the selected decks, then the same `pos` from any deck, then any word.
- Disabled, with a message, when the whole word list has fewer than four distinct meanings.

Done when: e2e answers right and wrong by keyboard (desktop) and by tap (mobile), with furigana on and off, in both directions.

### 9.2 Verb group sorter — `group`

- A verb appears in ます form (§8.3); answer 1, 2 or 3 (buttons or keys). Only verbs: decks without verbs can't start a round.
- Each answer is followed by the rule that decides it, quoting the dictionary form with its reading (帰る（かえる）— exception: …). The rule explains the stored group; it never decides it:
  - "doesn't end in -iru/-eru → group 1"
  - "ends in -iru/-eru → group 2"
  - "する, 来る and noun + する → group 3"
  - for group 1 verbs that look like group 2: "exception: looks like group 2, but it's group 1"

Done when: e2e covers one verb of each group plus 帰る, and the exception explanation appears.

### 9.3 Kana typing — `reading`, `recall`

- Reading mode: the kanji form (furigana hidden) → type the reading. Only words with kanji.
- Recall mode: a meaning → type the word in kana. All words.
- The mode is a setup option and the personal-best variant (§10.3). Verbs are asked and answered in ます form (§8.3: 食べます → たべます); the dictionary form (たべる, 食べる) counts too.
- Romaji converts as I type, into hiragana or katakana to match the expected answer, position by position in mixed words (`kopi-suru` → コピーする, `keshigomu` → けしゴム). As on a Japanese IME, nn is ん (こんにちは takes `konnnichiha`) and づ is `du`. A Japanese keyboard (IME or flick input) also works: nothing converts while it composes, and the Enter that confirms its conversion doesn't submit.
- Submitting finishes the conversion in the expected answer's script, so a trailing n becomes ん or ン (`kaishain` → かいしゃいん; `sarari-man` → サラリーマン, not サラリーマん).
- Answers are compared after converting both sides with WanaKana's `toHiragana`, once every ー is spelled out as the vowel it lengthens. (On its own, `toHiragana` reads オー as おう, so `koohii`, WanaKana's own romaji for コーヒー, would be wrong and `kouhii` right.) That gives the behavior we want:
  - the script doesn't matter (a note shows how the word is written when the spelling differs), including mixed words like コピーする, typed all in hiragana or all in katakana;
  - ー equals the vowel it lengthens, so `dezaina-` and `dezainaa` both match デザイナー, and `ko-hi-` and `koohii` match コーヒー (`kouhii` doesn't);
  - hiragana is compared exactly, so long vowels must be right: とおい ≠ とうい, and センセー ≠ せんせい.
- The exact kanji form is also accepted. In recall mode, if two words share the meaning (the same meaning text in the language shown, like 続く and 続ける, both "continuar"), either counts, and a note names the card's word. One shared gloss isn't enough: アパート and マンション are different apartments.
- A hint reveals the first kana and marks the answer as hinted.
- Once answered, right or wrong, the word shows with its furigana, and in reading mode its meaning, under the word on the card (below the card it would be behind a phone keyboard). Reading answers flag `reveals`, so a right one stays about 2.5 s (§8.3).

Done when: unit tests cover every acceptance case above; e2e types answers on desktop and on mobile.

### 9.4 Conjugation drill — `conjugation`

- A verb in ます form (§8.3) and a target form → produce the form: 書きます → て形. A ます question shows the dictionary form instead (書く → ます形). Form names are Japanese in both UI languages: 辞書形, ます形, ません, ました, ませんでした, て形, ない形, た形.
- Forms selectable per round; default all eight (§11). Forms I miss more often come up more often: the queue draws each card's form with weight 1 + 3 × miss rate, where the miss rate is (misses + 1) / (answers + 2) over that form's last 20 answers. A form missed every time comes up about 3.4× as often as one never missed; a form never asked sits in between.
- Input: typing (default on a computer) or four choices (default on a touch screen), switchable, and remembered with the rest of the setup.
- Typing accepts kana or the kanji form (こない or 来ない), compared as in §9.3.
- Choice distractors are plausible mistakes: another group's rule (帰ない, 食べって), the wrong て/た sound change (書って, 書きて), an exception ignored (行いて, あらない), the wrong stem (書くます, 書きない, 買あない) or the wrong way back to the dictionary form (書きる). When a verb has fewer than three, its other forms fill in, never the form it's shown in. Never duplicates, never a second correct answer.
- Options are written as the notebook writes them, with furigana per the round's option. When two would look the same in kanji (来ない read こない or きない), that question shows all four in kana.
- Each answer is followed by the rule, quoting the dictionary form: "書く（かく）— group 1, ends in く → いて"; 行く and ある are named as exceptions.

Done when: e2e answers in both input modes; the distractor generator is unit-tested.

## 10. Progress

### 10.1 Event log

- Every answer appends an `AnswerEvent { type: 'answer', id, at, roundId, game, wordId, skill, form?, correct, hinted, ms, device }`; every finished round appends a `RoundEvent { type: 'round', id, at, game, deckIds, size, variant, practice, score, correct, total }`. The round event's `id` is the `roundId` of its answers; it is written with the last answer. `at` is an ISO timestamp; `device` is a random id per install; `variant` is the game's part of the personal-best key (the quiz direction, the kana typing mode, the drill's input mode and forms like `choices|て+た`, or empty); `practice` marks a *Practice these* round.
- Events are append-only, in IndexedDB. Spaced-repetition state, scores, streaks and mastery are derived from them: held in memory, rebuilt at launch, after an import and after a reset, never stored on their own.
- Export saves the event log as a JSON file, `tangocho-progress-YYYY-MM-DD.json`: `{ app: "tangocho", version: 1, exportedAt, device, events }`. On a phone it opens the share sheet (save to Files, AirDrop, Mail) when the browser can share files; elsewhere it downloads.
- Import merges by event id: an event already here is never overwritten, so importing the same file twice changes nothing. A file that isn't JSON, isn't a Tangochō file or comes from a newer version is refused; invalid events in it are skipped and counted. Then the state rebuilds and Settings says how many events were new, already here and skipped. This is how progress moves between phone and computer in v1.
- Ask for persistent storage (`navigator.storage.persist()`) once there is progress, never on a blank first visit; Settings shows whether it was granted. Browsers may clear data for sites that haven't been used in a while, Safari on iPhone especially, so install the app on the phone. Settings shows the last export date; Today reminds me once 7 days have passed since the last export, or since the first answer if I never exported, unless nothing new happened since the last export (§7.1).

### 10.2 Spaced repetition

- FSRS via ts-fsrs, default parameters: no fuzz, so replaying the same log always gives the same state on every device, and the short-term learning steps (1 and 10 minutes), so a missed word comes back in the next round.
- A card is (word, skill) (§8.1); the conjugation form isn't part of it. Every answer is a review of its card, including answers in *Practice these* rounds and in rounds I quit.
- Answer → rating: wrong → *Again*; correct with a hint → *Hard*; correct → *Good*. *Easy* is never inferred.
- Due: a card scheduled in days is due from the start (04:00, §10.4) of its due day; a card in a learning step is due at its exact time.
- Round queue: due cards first (most overdue first), then new cards up to the daily limit (default 15, shared by all games, counted by the cards first answered today), then the least recently seen cards as extra practice, then, only if the round still isn't full, new cards past the limit. The limit decides what comes first; it never leaves a round short.
- Cards whose word was removed from the data, or that a game no longer accepts (a word that lost its kanji has no reading card), are ignored, not deleted.

### 10.3 Scores

- A correct answer earns 100 × combo multiplier (starts at 1.0, +0.1 per consecutive correct answer, max 2.0). A hinted answer earns half. A wrong answer earns 0 and resets the combo.
- Personal best per (game, deck selection, round size, variant), where the variant is the quiz direction, the kana typing mode, or the drill's input mode and selected forms; derived from the round events. Beating it shows a 新記録 stamp, and so does the first round for a key when it scores above 0. *Practice these* rounds never count.

### 10.4 Daily goal and streak

- Daily goal: a number of answers (default 20; options 10, 20, 50). A change applies from today on: past days keep the goal they had. The goal history stays on the device; days imported from the other device are judged by it.
- The day starts at 04:00 local time, so practice at 1 a.m. counts for the previous day.
- Streak = consecutive days with the goal met, up to today once today's goal is met, up to yesterday until then. Stamp card calendar: a hanko stamp for each goal day, 花丸 for days with a perfect round (every answer right, none hinted; *Practice these* rounds don't count here, though Results still shows their 花丸).

### 10.5 Mastery

- From FSRS stability: *New* (never seen), *Learning* (under 3 days), *Familiar* (3 to 21 days), *Mastered* (21 days or more).
- Mastery per deck counts cards: every (word, skill) some game can train, for the words in the deck.
- Stats: % mastered per deck, accuracy per verb group and per conjugation form, and per game the 10 weakest words, with *Practice these*. Weakest = the most misses among the card's last 20 answers, ties to the lower stability; a card needs at least one miss to be listed, so a word drops off once I get it right again.

## 11. Conjugation engine — `src/lib/conjugate.ts`

- Pure function `conjugate(word, form) → { kanji?, kana }`, or nothing when the verb doesn't fit its group (the validator reports those). It applies the rules to the kana and rewrites the ending of both forms.
- Forms in v1, by id: 辞書形 (dictionary), ます, ません, ました, ませんでした, て, ない, た. The ids are Japanese on purpose and are stored in answer events (§10.1), so they never change.
- Group 2: drop る and add the ending (食べる → 食べます, 食べて, 食べない, 食べた).
- Group 1:
  - ます forms: the final kana moves from the う-row to the い-row (書く → 書きます).
  - ない: the final kana moves to the あ-row, + ない, with う → わ (書く → 書かない, 買う → 買わない).
  - て and た: う・つ・る → って/った; む・ぶ・ぬ → んで/んだ; く → いて/いた; ぐ → いで/いだ; す → して/した.
- Group 3: する → します, して, しない, した…; noun + する keeps the noun (勉強します). 来る keeps its kanji but changes its reading: 来ます (きます), 来て (きて), 来ない (こない), 来た (きた). Verbs ending in てくる/でくる/にくる conjugate like 来る (持ってくる → 持ってきます, 持ってこない; 迎えに来る → 迎えに来ます, 迎えに来ない (むかえにこない)).
- Exceptions: 行く → 行って, 行った, and so do verbs ending in ていく/でいく (持っていく → 持っていって). ある → ない.
- The ます form helper from M1 (`src/lib/verbs.ts`, what the notebook shows) is folded into the engine; its rows join the table below.
- **Test-first.** `src/lib/conjugate.test.ts` is a table of (verb, form, expected kanji, expected kana) covering every group 1 ending, both exceptions, 来る, する, a noun + する verb and a katakana one (コピーする), 持っていく and 持ってくる with their kanji spellings 持って行く and 持って来る, 迎えに来る, the homophones 切る (group 1) and 着る (group 2), and 作る (group 1, though its reading ends in くる). I check every row against a reliable conjugation chart before the engine exists; after that, the agent never edits the table.

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
