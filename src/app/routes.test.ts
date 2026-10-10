import { describe, expect, it } from 'vitest';
import { gameHref, notebookHref, parseRoute, PLAY_HREF } from './routes.ts';

describe('parseRoute', () => {
  it('opens the notebook on the default deck for the root', () => {
    for (const hash of ['', '#', '#/', '#/notebook', '#/notebook/']) {
      expect(parseRoute(hash)).toEqual({ name: 'notebook', deckId: 'all' });
    }
  });

  it('reads the deck id', () => {
    expect(parseRoute('#/notebook/verbs-g2')).toEqual({ name: 'notebook', deckId: 'verbs-g2' });
    expect(parseRoute('#/notebook/occupations/')).toEqual({
      name: 'notebook',
      deckId: 'occupations',
    });
    expect(parseRoute('#/notebook/caf%C3%A9')).toEqual({ name: 'notebook', deckId: 'café' });
  });

  it('reads the game list and a game', () => {
    expect(parseRoute('#/play')).toEqual({ name: 'play' });
    expect(parseRoute('#/play/')).toEqual({ name: 'play' });
    expect(parseRoute('#/play/quiz')).toEqual({ name: 'game', gameId: 'quiz' });
  });

  it('reports anything else as not found', () => {
    expect(parseRoute('#/play/quiz/extra')).toEqual({ name: 'not-found', path: 'play/quiz/extra' });
    expect(parseRoute('#/notebook/a/b')).toEqual({ name: 'not-found', path: 'notebook/a/b' });
    expect(parseRoute('#/stats')).toEqual({ name: 'not-found', path: 'stats' });
  });

  it('builds hrefs that parse back', () => {
    expect(parseRoute(notebookHref('verbs-g1'))).toEqual({ name: 'notebook', deckId: 'verbs-g1' });
    expect(parseRoute(PLAY_HREF)).toEqual({ name: 'play' });
    expect(parseRoute(gameHref('quiz'))).toEqual({ name: 'game', gameId: 'quiz' });
  });
});
