import '@fontsource/zen-kurenaido/400.css';
import '@fontsource/yomogi/400.css';
import '@fontsource/biz-udpgothic/400.css';
import '@fontsource/biz-udpgothic/700.css';
import '@fontsource/zen-maru-gothic/400.css';
import '@fontsource/zen-maru-gothic/700.css';
import type { CSSProperties } from 'react';
import { Ruby } from '../../components/Ruby.tsx';
import type { FuriganaPair } from '../../lib/furigana.ts';
import styles from './FontTryout.module.css';

/**
 * Dev only (#/dev/fonts): the same samples in every candidate face, for choosing the fonts from
 * screenshots (SPEC §13). Deleted once the choice is made.
 */

const PROMPT_FACES = [
  { name: 'Klee One · spec candidate', family: "'Klee One'" },
  { name: 'Zen Kurenaido', family: "'Zen Kurenaido'" },
  { name: 'Yomogi', family: "'Yomogi'" },
];

const UI_FACES = [
  { name: 'Zen Kaku Gothic New · spec candidate', family: "'Zen Kaku Gothic New'" },
  { name: 'BIZ UDPGothic', family: "'BIZ UDPGothic'" },
  { name: 'Zen Maru Gothic', family: "'Zen Maru Gothic'" },
];

const PROMPT: FuriganaPair[] = [
  ['食', 'た'],
  ['べる', ''],
];

const WORDS: FuriganaPair[][] = [
  [
    ['勉強', 'べんきょう'],
    ['する', ''],
  ],
  [['会社員', 'かいしゃいん']],
  [['時々', 'ときどき']],
  [
    ['帰', 'かえ'],
    ['る', ''],
  ],
  [['デザイナー', '']],
];

const vars = (name: '--font-ja' | '--font-ui', family: string) =>
  ({ [name]: family }) as CSSProperties;

export default function FontTryout() {
  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>Japanese prompt face</h2>
        <div className={styles.grid}>
          {PROMPT_FACES.map((face) => (
            <article key={face.name} className={styles.card} style={vars('--font-ja', face.family)}>
              <span className={styles.label}>{face.name}</span>
              <Ruby pairs={PROMPT} className={styles.prompt} />
              <div className={styles.words}>
                {WORDS.map((pairs, i) => (
                  <Ruby key={i} pairs={pairs} />
                ))}
              </div>
              <p className={styles.sentence} lang="ja">
                切る・着る・持ってくる・一ヶ月・ぎゅうにゅう・ポケット
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>UI face</h2>
        <div className={styles.grid}>
          {UI_FACES.map((face) => (
            <article
              key={face.name}
              className={`${styles.card} ${styles.ui}`}
              style={vars('--font-ui', face.family)}
            >
              <span className={styles.label}>{face.name}</span>
              <h3>Notebook · Cuaderno</h3>
              <p className={styles.tab}>
                Verbs · Group 2<span lang="ja">動詞・2グループ</span>
              </p>
              <p>to sleep, to go to bed · dormir, acostarse</p>
              <p className={styles.soft}>
                for clothes on the upper body; trousers and shoes use <span lang="ja">はく</span>
              </p>
              <p className={styles.soft}>
                32 words · 32 palabras · Nuevas esta semana · 0123456789
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
