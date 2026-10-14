import { useMemo } from 'react';
import { gameHref } from '../../app/routes.ts';
import buttons from '../../components/Buttons.module.css';
import { StampCard } from '../../components/StampCard.tsx';
import { words } from '../../data/load.ts';
import { GAMES } from '../../games/registry.ts';
import { useLang, useT } from '../../i18n/hooks.ts';
import { DECKS, KNOWN_DECKS, OPENED_AT } from '../../play/catalog.ts';
import { continueGame, dueCount } from '../../play/due.ts';
import { loadSetup, setupBlocker, setupPool } from '../../play/setup.ts';
import { dayKey, monthOf } from '../../progress/day.ts';
import { exportReminder, goalOn, streak } from '../../progress/goal.ts';
import { useCalendar } from '../../progress/useCalendar.ts';
import { useNow } from '../../progress/useNow.ts';
import { useProgress } from '../../progress/useProgress.ts';
import { useSettings } from '../../progress/useSettings.ts';
import { ExportBanner } from './ExportBanner.tsx';
import { useFreshStamp } from './freshStamp.ts';
import styles from './Today.module.css';

/**
 * Today, the home screen (SPEC §7.1): the streak and this month's stamp card, the daily goal,
 * each game with its due cards, and *Continue*.
 */
export function Today() {
  const t = useT();
  const { lang } = useLang();
  const now = useNow();
  const { status, events, cards } = useProgress();
  const settings = useSettings();
  const calendar = useCalendar();
  const today = dayKey(now);

  // each game as its remembered setup would play it
  const games = useMemo(
    () =>
      GAMES.map((game) => {
        const choice = loadSetup(game.id, KNOWN_DECKS);
        const pool = setupPool(game, choice, DECKS, words, OPENED_AT);
        const blocker = setupBlocker(game, choice, pool, words, lang);
        const due = blocker === undefined ? dueCount(game, choice.options, pool, cards, now) : 0;
        return { game, due, blocker };
      }),
    [cards, now, lang],
  );
  const next = continueGame(
    games.map(({ game, due, blocker }) => ({ id: game.id, due, playable: blocker === undefined })),
    events.at(-1)?.game,
  );
  const nextGame = GAMES.find((g) => g.id === next);

  const answered = calendar.perDay.get(today) ?? 0;
  const goal = goalOn(settings.goals, today);
  const streakDays = streak(calendar.goalDays, today);
  const remind = exportReminder({
    lastExportAt: settings.lastExportAt,
    firstEventAt: events[0]?.at,
    lastEventAt: events.at(-1)?.at,
    now,
  });
  const { year, month } = monthOf(today);
  const fresh = useFreshStamp(today, status === 'ready', calendar.goalDays.has(today));

  return (
    <section className={styles.today} aria-labelledby="today-title">
      <h1 id="today-title" className={styles.title}>
        {t('today_title')}{' '}
        <span lang="ja" className={styles.titleJa}>
          今日
        </span>
      </h1>

      {status === 'failed' && <p className={styles.note}>{t('progress_failed')}</p>}
      {remind && <ExportBanner never={settings.lastExportAt === undefined} />}

      <div className={styles.summary}>
        <div className={styles.tile} data-streak={streakDays}>
          <p className={styles.label}>{t('today_streak_label')}</p>
          <p className={styles.big}>
            {t(streakDays === 1 ? 'today_streak_one' : 'today_streak_other', { n: streakDays })}
          </p>
        </div>
        <div className={styles.tile} data-goal={goal} data-answered={answered}>
          <p className={styles.label}>{t('today_goal_label')}</p>
          <p className={styles.big}>{t('today_goal', { n: answered, goal })}</p>
          <div className={styles.track} aria-hidden="true">
            <div
              className={styles.fill}
              style={{ inlineSize: `${Math.min(100, (answered / goal) * 100)}%` }}
            />
          </div>
          {answered >= goal && <p className={styles.met}>{t('today_goal_met')}</p>}
        </div>
      </div>

      {nextGame !== undefined && (
        <a
          href={gameHref(nextGame.id, 'continue')}
          className={`${buttons.primary} ${styles.continue}`}
          data-continue={nextGame.id}
        >
          {t('today_continue_with', { game: t(nextGame.nameKey) })}
        </a>
      )}

      <h2 className={styles.subtitle}>{t('today_games')}</h2>
      <ul className={styles.games}>
        {games.map(({ game, due, blocker }) => (
          <li key={game.id}>
            <a href={gameHref(game.id)} className={styles.game} data-game={game.id}>
              <span className={styles.name}>{t(game.nameKey)}</span>
              <span className={styles.ja} lang="ja">
                {game.nameJa}
              </span>
              {blocker === undefined ? (
                <span className={due > 0 ? styles.due : styles.none} data-due={due}>
                  {due === 0
                    ? t('today_due_none')
                    : t(due === 1 ? 'today_due_one' : 'today_due_other', { n: due })}
                </span>
              ) : (
                <span className={styles.none}>
                  {t(blocker.key, 'n' in blocker ? { n: blocker.n } : undefined)}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>

      <h2 className={styles.subtitle}>{t('stamp_card')}</h2>
      <StampCard
        year={year}
        month={month}
        today={today}
        goalDays={calendar.goalDays}
        perfectDays={calendar.perfectDays}
        {...(fresh !== undefined && { fresh })}
      />
    </section>
  );
}
