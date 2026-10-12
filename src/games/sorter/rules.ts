import { looksLikeGroup2 } from '../../data/rules.ts';
import type { VerbGroup, Word } from '../../data/schema.ts';

/**
 * Verb group sorter (SPEC §9.2), the pure part. The group always comes from the data (§5.3);
 * the rule only explains it, so the ending never decides anything here.
 */

export type GroupRule = 'g1' | 'g1-exception' | 'g2' | 'g3';

/** A verb with its group: the sorter can ask about it. */
export function isSortable(word: Word): word is Word & { verbGroup: VerbGroup } {
  return word.pos === 'verb' && word.verbGroup !== undefined;
}

export function checkGroup(word: Word, given: VerbGroup): boolean {
  return word.verbGroup === given;
}

/**
 * The rule that decides a verb's group, to show with the answer. A group 1 verb ending in
 * -iru/-eru gets the exception line, whether or not it is on the validator's list (帰る, しゃべる).
 */
export function groupRule(word: Word & { verbGroup: VerbGroup }): GroupRule {
  switch (word.verbGroup) {
    case 1:
      return looksLikeGroup2(word.kana) ? 'g1-exception' : 'g1';
    case 2:
      return 'g2';
    case 3:
      return 'g3';
  }
}
