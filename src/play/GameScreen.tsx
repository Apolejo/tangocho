import { useEffect, useState } from 'react';
import { deckId, notebookDecks, wordsInDecks } from '../data/decks.ts';
import { decks, words } from '../data/load.ts';
import type { Word } from '../data/schema.ts';
import type { Minigame } from '../games/types.ts';
import { mulberry32, newId, randomSeed } from '../lib/random.ts';
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

type Phase =
  | { name: 'setup' }
  | { name: 'round'; plan: RoundPlan }
  | { name: 'results'; plan: RoundPlan; answers: readonly AnswerRecord[]; tally: Tally };

/** One game's screens: setup → play → results. A reload mid-round goes back to setup. */
export function GameScreen({ game }: { game: Minigame }) {
  const [choice, setChoice] = useState(() => loadSetup(game.id, KNOWN_DECKS));
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });

  const view = phase.name === 'setup' ? 'setup' : `${phase.name}-${phase.plan.id}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const change = (next: SetupChoice) => {
    setChoice(next);
    saveSetup(game.id, next);
  };

  const start = (
    from: Pick<RoundPlan, 'deckIds' | 'options'> & { size: number },
    only?: readonly Word[],
  ) => {
    const selected = DECKS.filter((d) => from.deckIds.includes(deckId(d)));
    const plan = planRound({
      id: newId(),
      game,
      deckIds: from.deckIds,
      size: from.size,
      options: from.options,
      words: wordsInDecks(selected, words, OPENED_AT),
      only,
      rng: mulberry32(randomSeed()),
    });
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
          onStart={() => start(choice)}
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
          onPractice={(missed) => start(phase.plan, missed)}
          onAgain={() => start(choice)}
          onSetup={() => setPhase({ name: 'setup' })}
        />
      );
  }
}
