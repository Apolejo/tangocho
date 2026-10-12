import { Fragment } from 'react';
import { japaneseRuns } from '../lib/jp.ts';

/**
 * UI text that quotes Japanese ("する, 来る and noun + する → group 3"): each Japanese run gets
 * lang="ja", so it renders with Japanese glyph shapes (SPEC §6).
 */
export function JaText({ text }: { text: string }) {
  return japaneseRuns(text).map((run, i) =>
    run.ja ? (
      <span key={i} lang="ja">
        {run.text}
      </span>
    ) : (
      <Fragment key={i}>{run.text}</Fragment>
    ),
  );
}
