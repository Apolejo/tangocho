import { gameHref } from '../app/routes.ts';
import { words } from '../data/load.ts';
import { GAMES } from '../games/registry.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import styles from './PlayHub.module.css';
import { unavailableReason } from './setup.ts';

/** The game list (#/play). The Today screen takes over as home in M8. */
export function PlayHub() {
  const t = useT();
  const { lang } = useLang();
  return (
    <section className={styles.hub} aria-labelledby="play-title">
      <h1 id="play-title" className={styles.title}>
        {t('play_title')}
      </h1>
      <ul className={styles.games}>
        {GAMES.map((game) => {
          const reason = unavailableReason(game, words, lang);
          return (
            <li key={game.id}>
              <a href={gameHref(game.id)} className={styles.game}>
                <span className={styles.name}>{t(game.nameKey)}</span>
                <span className={styles.ja} lang="ja">
                  {game.nameJa}
                </span>
                <span className={styles.description}>{t(game.descriptionKey)}</span>
                {reason !== undefined && (
                  <span className={styles.warning}>
                    {t(reason.key, 'n' in reason ? { n: reason.n } : undefined)}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
