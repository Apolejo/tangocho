import { Fragment } from 'react';
import type { FuriganaPair } from '../lib/furigana.ts';

/**
 * Japanese text with furigana as <ruby>; kana parts render as plain text (SPEC §5.4).
 * `readings={false}` shows the written form alone (furigana off).
 */
export function Ruby({
  pairs,
  className,
  readings = true,
}: {
  pairs: FuriganaPair[];
  className?: string;
  readings?: boolean;
}) {
  if (!readings) {
    return (
      <span lang="ja" className={className}>
        {pairs.map(([text]) => text).join('')}
      </span>
    );
  }
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
