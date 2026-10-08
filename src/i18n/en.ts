/** Every UI string. es.ts must define exactly these keys (the type checker enforces it). */
export const en = {
  appName: 'Tangochō',
  nav_notebook: 'Notebook',
  decks_label: 'Decks',
  deck_all: 'All words',
  deck_new: 'New this week',
  notebook_empty: 'No words in this deck yet.',
  notebook_unknown_deck: 'There is no deck with that name.',
  notebook_count_one: '{n} word',
  notebook_count_other: '{n} words',
  group_badge: 'Group {n}',
  group_abbr: 'G{n}',
  language_label: 'Language',
  lang_en: 'English',
  lang_es: 'Español',
  not_found: 'Nothing here.',
  not_found_link: 'Back to the notebook',
} satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
export type Messages = { readonly [K in MessageKey]: string };
