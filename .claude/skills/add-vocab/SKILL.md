---
name: add-vocab
description: Import vocabulary from photos of my paper notebook (or pasted text) into data/words/, validated and approved by me before anything is written.
disable-model-invocation: true
---

# Add vocabulary from my notebook

Arguments: $ARGUMENTS
If the last argument ends in `.json`, it's the target file in `data/words/`; everything before it is the source label for these pages (for example `notebook-1 p.12`). Without a target file, use one file per notebook section (`verbs.json`, `occupations.json`).
Photos are attached to the message or waiting in `inbox/` (git-ignored).

My notebook is the input, not the authority. I'm a learner and my notes can be wrong. Never fix anything silently: flag it and let me decide.

## 1. Transcribe

- Transcribe every entry exactly as written (kanji, kana, romaji, meaning), together with the section heading it sits under (for example "Group 2" or "Occupations").
- If you can't read something with certainty, say so. Never guess silently.

## 2. Normalize to SPEC §5.1

- Verbs written in ます form become dictionary form (書きます → 書く).
- `verbGroup` comes from the notebook's section heading. If the notes don't say, propose one.
- Words written only in romaji become kana. Words written only in kana that are normally written with kanji get the kanji proposed.
- Meanings in both English and Spanish; fill in whichever language is missing.
- `id` as SPEC §5.1 defines it (romaji of the reading, `<noun>-suru` for noun + する verbs, a gloss for homophones such as `kiru-cut`). It must not exist in `data/words/` yet.
- `tags` from the section (for example `occupations`), `added` = today, `source` = the label from the arguments.
- Duplicate: same kanji (or both without), kana, `pos` and `verbGroup`, with overlapping meanings. List it, don't add it.
- Homophone: same reading but a different word (いる "to exist" and いる "to need"). Add it with a glossed id and flag it.

## 3. Validate

Write the entries to `inbox/staged.json` and run `npm run validate -- inbox/staged.json`. Fix mechanical problems (format, ids) yourself; everything else goes into the table.

## 4. Review table, then stop

One row per word:

| # | As written | Kanji | Kana | Pos | Group | EN | ES | Tags | Flags |

Flags, using exactly these words:
- `unclear`: handwriting you couldn't read with certainty
- `notebook?`: looks like a mistake in my notes (write your suggested correction)
- `added`: something you supplied (a translation, a dictionary form, a kanji, a kana conversion, a proposed group)
- `group?`: the validator warns that it looks like the other group
- `duplicate`: already in the data
- `homophone`: shares its reading with another word; check the glossed id

Then STOP and wait for my reply. I'll answer with corrections or "approve". Before approving, I check anything flagged `notebook?` or `group?` in a dictionary such as Jisho.

## 5. Write and commit, only after "approve"

- Append the approved entries, in notebook order, to the target file in `data/words/` (create it if needed).
- Run `npm run check`; fix and re-run until it passes.
- Commit with the message `vocab: add N words (<decks>) from <source>`.
- Move the processed photos to `inbox/done/` and delete `inbox/staged.json`.
- Report the files changed and how many words each deck gained.
