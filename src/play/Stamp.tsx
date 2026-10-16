import type { CSSProperties } from 'react';
import styles from './Stamp.module.css';

/**
 * Hanko-style marks (SPEC §13): ◯ in green for correct, ✕ in ink for wrong, the 新記録 seal
 * for a personal best, the 花丸 for a perfect round, and the round 済 seal for a day whose goal was
 * met on the stamp card (SPEC §10.4).
 * With `animate`, a seal presses onto the paper and the 花丸 draws itself, spiral then petals,
 * after `delay` ms. The finished mark is the resting state, so under prefers-reduced-motion
 * (no animation at all, base.css) it simply appears.
 * The shape carries the meaning; `label` names it for screen readers.
 */
export type StampKind = 'maru' | 'batsu' | 'record' | 'hanamaru' | 'hanko';

export function Stamp({
  kind,
  label,
  animate = false,
  delay = 0,
}: {
  kind: StampKind;
  label?: string;
  animate?: boolean;
  delay?: number;
}) {
  const a11y = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  const motion = animate ? (kind === 'hanamaru' ? styles.draw : styles.press) : '';
  const props = animate
    ? { ...a11y, 'data-animate': true, style: { '--stamp-delay': `${delay}ms` } as CSSProperties }
    : a11y;
  switch (kind) {
    case 'maru':
      return (
        <svg
          className={`${styles.stamp} ${styles.maru} ${motion}`}
          viewBox="0 0 100 100"
          {...props}
        >
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray="226 13"
            transform="rotate(-70 50 50)"
          />
        </svg>
      );
    case 'batsu':
      return (
        <svg
          className={`${styles.stamp} ${styles.batsu} ${motion}`}
          viewBox="0 0 100 100"
          {...props}
        >
          <path d="M24 24 L76 76 M76 24 L24 76" fill="none" strokeWidth="9" strokeLinecap="round" />
        </svg>
      );
    case 'record':
      return (
        <span className={`${styles.record} ${motion}`} {...props}>
          <span lang="ja">新記録</span>
        </span>
      );
    case 'hanko':
      return (
        <svg
          className={`${styles.stamp} ${styles.hanko} ${motion}`}
          viewBox="0 0 100 100"
          {...props}
        >
          <circle cx="50" cy="50" r="43" fill="none" strokeWidth="6" />
          <text x="50" y="54" textAnchor="middle" dominantBaseline="middle" lang="ja">
            済
          </text>
        </svg>
      );
    case 'hanamaru':
      return (
        <svg
          className={`${styles.stamp} ${styles.hanamaru} ${motion}`}
          viewBox="0 0 100 100"
          {...props}
        >
          {/* petals around the edge, then the spiral inside (drawn spiral first) */}
          <path
            className={styles.petals}
            pathLength="1"
            d="M84 50 A13 13 0 0 1 74 74 A13 13 0 0 1 50 84 A13 13 0 0 1 26 74 A13 13 0 0 1 16 50 A13 13 0 0 1 26 26 A13 13 0 0 1 50 16 A13 13 0 0 1 74 26 A13 13 0 0 1 84 50"
            fill="none"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            className={styles.spiral}
            pathLength="1"
            d="M54 50 A4 4 0 0 0 46 50 A8 8 0 0 0 62 50 A12 12 0 0 0 38 50 A16 16 0 0 0 70 50 A20 20 0 0 0 30 50"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
