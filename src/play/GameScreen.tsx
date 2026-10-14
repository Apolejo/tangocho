import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { focusScreenHeading } from '../app/focus.ts';
import { gameHref, type GameIntent } from '../app/routes.ts';
import { deckId, wordsInDecks } from '../data/decks.ts';
import { words } from '../data/load.ts';
import type { Card, Minigame } from '../games/types.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { mulberry32, newId, randomSeed } from '../lib/random.ts';
import { dayKey } from '../progress/day.ts';
import { formStats } from '../progress/forms.ts';
import { getSettings } from '../progress/settings.ts';
import { introducedOn } from '../progress/srs.ts';
import { weakestCards } from '../progress/stats.ts';
import { progress } from '../progress/store.ts';
import { DECKS, KNOWN_DECKS, OPENED_AT } from './catalog.ts';
import { planRound, type RoundPlan } from './plan.ts';
import { Results } from './Results.tsx';
import { Round } from './Round.tsx';
import type { AnswerRecord } from './round.ts';
import type { Tally } from './score.ts';
import { Setup } from './Setup.tsx';
import { loadSetup, saveSetup, setupBlocker, setupPool, type SetupChoice } from './setup.ts';

const WORDS_BY_ID = new Map(words.map((w) => [w.id, w]));

type Phase =
  | { name: 'starting' }
  | { name: 'setup' }
  | { name: 'round'; plan: RoundPlan }
  | { name: 'results'; plan: RoundPlan; answers: readonly AnswerRecord[]; tally: Tally };

/**
 * One game's screens: setup → play → results. A reload mid-round goes back to setup. With an
 * intent it starts a round at once: *Continue* from Today plays the remembered setup, *Practice
 * these* from Stats plays the game's weakest cards (SPEC §7.1, §7.6); when that can't run, setup.
 */
export function GameScreen({ game, intent }: { game: Minigame; intent?: GameIntent }) {
  const t = useT();
  const { lang } = useLang();
  const [choice, setChoice] = useState(() => loadSetup(game.id, KNOWN_DECKS));
  const [phase, setPhase] = useState<Phase>(() =>
    intent === undefined ? { name: 'setup' } : { name: 'starting' },
  );
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  // each view starts at the top; setup and results take the focus at their heading (SPEC §8.3),
  // while a round places it itself (Round.tsx). The first view is the screen's, focused by App.
  const view = 'plan' in phase ? `${phase.name}-${phase.plan.id}` : phase.name;
  const viewShown = useRef(view);
  const focusesHeading = phase.name === 'setup' || phase.name === 'results';
  useEffect(() => {
    window.scrollTo(0, 0);
    if (viewShown.current === view) return;
    viewShown.current = view;
    if (focusesHeading) focusScreenHeading();
  }, [view, focusesHeading]);

  const change = (next: SetupChoice) => {
    setChoice(next);
    saveSetup(game.id, next);
  };

  // the queue reads the log (SPEC §10.2): due cards, today's new cards, and the forms missed more
  // often for a game whose cards have one; a log that couldn't be read leaves every card new
  const start = async (
    from: Pick<RoundPlan, 'deckIds' | 'options'> & { size: number },
    only?: readonly Card[],
  ) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    await progress.load();
    const { answers, cards } = progress.getSnapshot();
    const now = new Date();
    const stats =
      game.formsFor !== undefined
        ? formStats(answers.filter((a) => a.game === game.id))
        : undefined;
    const newLeft = Math.max(0, getSettings().newPerDay - introducedOn(cards, dayKey(now)));
    const selected = DECKS.filter((d) => from.deckIds.includes(deckId(d)));
    const plan = planRound({
      id: newId(),
      game,
      deckIds: from.deckIds,
      size: from.size,
      options: from.options,
      words: wordsInDecks(selected, words, OPENED_AT),
      only,
      formStats: stats,
      srs: { cards, now, newLeft },
      rng: mulberry32(randomSeed()),
    });
    startingRef.current = false;
    setStarting(false);
    setPhase({ name: 'round', plan });
  };

  // the intent is used once: the address goes back to the plain game, so a reload shows setup
  const startAtOnce = useEffectEvent(() => {
    window.history.replaceState(null, '', gameHref(game.id));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    if (intent === 'weakest') {
      const weak = weakestCards(progress.getSnapshot().cards, game, WORDS_BY_ID);
      if (weak.length > 0) {
        void start(
          { deckIds: ['all'], size: weak.length, options: choice.options },
          weak.map((w) => w.card),
        );
        return;
      }
    } else if (intent === 'continue') {
      const pool = setupPool(game, choice, DECKS, words, OPENED_AT);
      if (setupBlocker(game, choice, pool, words, lang) === undefined) {
        void start(choice);
        return;
      }
    }
    setPhase({ name: 'setup' });
  });
  useEffect(() => {
    if (intent === undefined) return;
    let alive = true;
    void progress.load().then(() => {
      if (alive) startAtOnce();
    });
    return () => {
      alive = false;
    };
  }, [intent]);

  switch (phase.name) {
    case 'starting':
      return (
        <p role="status" style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center' }}>
          {t('progress_loading')}
        </p>
      );
    case 'setup':
      return (
        <Setup
          game={game}
          decks={DECKS}
          allWords={words}
          now={OPENED_AT}
          choice={choice}
          onChange={change}
          starting={starting}
          onStart={() => void start(choice)}
        />
      );
    case 'round':
      return (
        <Round
          key={phase.plan.id}
          game={game}
          plan={phase.plan}
          allWords={words}
          onDone={(answers, tally) =>
            setPhase({ name: 'results', plan: phase.plan, answers, tally })
          }
          onQuit={() => setPhase({ name: 'setup' })}
        />
      );
    case 'results':
      return (
        <Results
          key={phase.plan.id}
          game={game}
          plan={phase.plan}
          answers={phase.answers}
          tally={phase.tally}
          allWords={words}
          onPractice={(missed) => void start(phase.plan, missed)}
          onAgain={() => void start(choice)}
          onSetup={() => setPhase({ name: 'setup' })}
        />
      );
  }
}
