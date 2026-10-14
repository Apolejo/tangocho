import { useEffect, useRef, useState } from 'react';
import { deckId, wordsInDecks } from '../data/decks.ts';
import { words } from '../data/load.ts';
import type { Card, Minigame } from '../games/types.ts';
import { mulberry32, newId, randomSeed } from '../lib/random.ts';
import { dayKey } from '../progress/day.ts';
import { formStats } from '../progress/forms.ts';
import { getSettings } from '../progress/settings.ts';
import { introducedOn } from '../progress/srs.ts';
import { progress } from '../progress/store.ts';
import { DECKS, KNOWN_DECKS, OPENED_AT } from './catalog.ts';
import { planRound, type RoundPlan } from './plan.ts';
import { Results } from './Results.tsx';
import { Round } from './Round.tsx';
import type { AnswerRecord } from './round.ts';
import type { Tally } from './score.ts';
import { Setup } from './Setup.tsx';
import { loadSetup, saveSetup, type SetupChoice } from './setup.ts';

type Phase =
  | { name: 'setup' }
  | { name: 'round'; plan: RoundPlan }
  | { name: 'results'; plan: RoundPlan; answers: readonly AnswerRecord[]; tally: Tally };

/** One game's screens: setup → play → results. A reload mid-round goes back to setup. */
export function GameScreen({ game }: { game: Minigame }) {
  const [choice, setChoice] = useState(() => loadSetup(game.id, KNOWN_DECKS));
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  const view = phase.name === 'setup' ? 'setup' : `${phase.name}-${phase.plan.id}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

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

  switch (phase.name) {
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
