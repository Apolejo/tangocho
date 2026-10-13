import { useEffect, useRef, useState } from 'react';
import { deckId, notebookDecks, wordsInDecks } from '../data/decks.ts';
import { decks, words } from '../data/load.ts';
import type { Card, GameId, Minigame } from '../games/types.ts';
import { mulberry32, newId, randomSeed } from '../lib/random.ts';
import { answerEvents } from '../progress/db.ts';
import { formStats, type FormStats } from '../progress/forms.ts';
import { planRound, type RoundPlan } from './plan.ts';
import { Results } from './Results.tsx';
import { Round } from './Round.tsx';
import type { AnswerRecord } from './round.ts';
import type { Tally } from './score.ts';
import { Setup } from './Setup.tsx';
import { loadSetup, saveSetup, type SetupChoice } from './setup.ts';

const DECKS = notebookDecks(decks);
const KNOWN_DECKS = new Set(DECKS.map(deckId));
/** "New this week" is relative to when the app was opened, as in the notebook. */
const OPENED_AT = new Date();

/** Misses per form from the log; if it can't be read, every form weighs the same. */
async function readFormStats(game: GameId): Promise<FormStats | undefined> {
  try {
    return formStats(await answerEvents(game));
  } catch (error: unknown) {
    console.warn('could not read past answers', error);
    return undefined;
  }
}

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

  // a game whose cards have a form reads the past answers first, so missed forms weigh more
  const start = async (
    from: Pick<RoundPlan, 'deckIds' | 'options'> & { size: number },
    only?: readonly Card[],
  ) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    const stats =
      game.formsFor !== undefined && only === undefined ? await readFormStats(game.id) : undefined;
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
