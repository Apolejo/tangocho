import { Fragment } from 'react';
import type { FuriganaPair } from '../lib/furigana.ts';

/** Japanese text with furigana as <ruby>; kana parts render as plain text (SPEC §5.4). */
export function Ruby({ pairs, className }: { pairs: FuriganaPair[]; className?: string }) {
  return (
    <span lang="ja" className={className}>
      {pairs.map(([text, reading], i) =>
        reading === '' ? (
          <Fragment key={i}>{text}</Fragment>
        ) : (
          <ruby key={i}>
            {text}
            <rp>(</rp>
            <rt>{reading}</rt>
            <rp>)</rp>
          </ruby>
        ),
      )}
    </span>
  );
}
