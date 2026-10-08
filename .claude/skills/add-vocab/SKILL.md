---
name: add-vocab
description: Import vocabulary from photos of my paper notebook (or pasted text) into data/words/, validated and approved by me before anything is written.
argument-hint: <source label> [target.json]
disable-model-invocation: true
---

# Add vocabulary from my notebook

Arguments: $ARGUMENTS
If the last argument ends in `.json`, it's the target file in `data/words/`; everything before it is the source label for these pages (for example `notebook-1 p.12`). Without a target file, use one file per notebook section (see "Files and decks").
Photos are attached to the message or waiting in `inbox/` (git-ignored).

My notebook is the input, not the authority. I'm a learner and my notes can be wrong. Never fix anything silently: flag it and let me decide.

## 1. Transcribe

- Transcribe every entry exactly as written (kanji, kana, romaji, meaning), together with the section heading it sits under (for example "Group 2" or "Occupations").
- If you can't read something with certainty, say so. Never guess silently.

## 2. Normalize to SPEC §5.1

The validator (`src/data/schema.ts`, `src/data/rules.ts`) enforces the mechanical part; the judgment calls are mine.

- The schema is strict: only the fields in §5.1, no `romaji` or anything else. `added` = today as `YYYY-MM-DD`; `source` = the label from the arguments; `tags` kebab-case. A usage note from the notebook goes in `note` (en and es, short).
- `pos`: `verb`, `noun`, `i-adj`, `na-adj`, `adverb`, `phrase` (expressions such as おはようございます) or `other`.
- `kana`: hiragana and katakana only, plus ー. Katakana words stay katakana.
- `kanji`: only kanji, kana, ー, 々 and ヶ, and only when there is at least one kanji. Drop spaces, ・, brackets and punctuation. A 〜 placeholder or a particle written with the word (〜に乗る) is stripped: the bare word goes in `kanji`/`kana`, the pattern goes in `note`, flagged `added`.
- Verbs: dictionary form (書きます → 書く), flagged `added` when the notebook had the ます form. `verbGroup` comes from the section heading or my note; if the notes don't say, propose one and flag `added`. The validator rejects a group 2 verb that doesn't end in -iru/-eru, a group 2 label on a known group 1 verb (帰る, 入る, 切る, 走る, 知る, 要る...), and a group 3 verb that isn't する, くる or noun + する. Never change the group to make it pass: flag `notebook?` with the suggested group.
- Words written only in romaji become kana. Words written only in kana that are normally written with kanji get the kanji proposed, flagged `added`.
- Meanings in both English and Spanish; fill in whichever language is missing and flag `added`. Keep the notebook's wording where it is right.
- `id`: WanaKana-style romaji of the kana, one run, no hyphens or apostrophes: きょう → `kyou`, がっこう → `gakkou`, まっちゃ → `matcha`, を → `wo`, づ → `zu`, コーヒー → `koohii`, デザイナー → `dezainaa`. Noun + する verbs as `<noun>-suru` (`benkyou-suru`). The id must be new: grep `data/words/` for it. A clash with a different word is a homophone: add a gloss (`kiru-cut`, `kiru-wear`) and flag `homophone`.
- Duplicate: same kanji (or both without), kana, `pos` and `verbGroup`, with overlapping meanings. Judge the overlap yourself; the validator only warns on an identical meaning string. List it with the flag `duplicate`, don't add it.
- Furigana: if the validator says the reading does not fit the kanji, re-check the transcription first (usually `unclear`). If it says the placement is ambiguous, add a manual `furigana` field and flag `added`.

## Files and decks

- One file per notebook section. List `data/words/` first and reuse the file for that section; otherwise name it after the section's tag (`occupations.json`, `adjectives.json`), verbs by group (`verbs-g1.json`). A mixed page appends to several files.
- Tags come from the section (`occupations`). When no deck in `data/decks.json` matches the section, propose one: `id` = the tag, `name` in en, es and ja, `match` by tag or pos. It goes in the "New decks" block of the review table and is written only on approve.

## 3. Validate

Write the entries to `inbox/staged.json` and run `npm run validate -- inbox/staged.json`. Fix mechanical problems (format, ids) yourself; everything else goes into the table.

## 4. Review table, then stop

One row per word, in notebook order:

| # | As written | File | Kanji | Kana | Pos | Group | EN | ES | Tags | Flags |

Then, if any, **New decks**: one line per deck with id, names and match.

Flags, using exactly these words:
- `unclear`: handwriting you couldn't read with certainty
- `notebook?`: looks like a mistake in my notes (write your suggested correction)
- `added`: something you supplied (a translation, a dictionary form, a kanji, a kana conversion, a proposed group, a manual furigana)
- `group?`: the validator warns that it looks like the other group
- `duplicate`: already in the data
- `homophone`: shares its reading with another word; check the glossed id

Then STOP and wait for my reply. I'll answer with corrections or "approve". Before approving, I check anything flagged `notebook?` or `group?` in a dictionary such as Jisho.

## 5. Write and commit, only after "approve"

- Append the approved entries, in notebook order, to their files in `data/words/` (create a file if needed), and the approved decks to `data/decks.json`. A hook runs the validator after each of these edits and sends the report back: fix mechanical problems, never silently change something I decided.
- Run `npm run check`; fix and re-run until it passes.
- Commit with the message `vocab: add N words (<files>) from <source>`.
- If the photos were in `inbox/`, move them to `inbox/done/`. Delete `inbox/staged.json`.
- Report the files changed and how many words each deck gained.
