import { describe, expect, it } from 'vitest';
import {
  gameHref,
  notebookHref,
  parseRoute,
  PLAY_HREF,
  SETTINGS_HREF,
  STATS_HREF,
  TODAY_HREF,
} from './routes.ts';

describe('parseRoute', () => {
  it('opens Today for the root', () => {
    for (const hash of ['', '#', '#/', '#/today', '#/today/']) {
      expect(parseRoute(hash)).toEqual({ name: 'today' });
    }
  });

  it('opens the notebook on the default deck', () => {
    for (const hash of ['#/notebook', '#/notebook/']) {
      expect(parseRoute(hash)).toEqual({ name: 'notebook', deckId: 'all' });
    }
  });

  it('reads Stats and Settings', () => {
    expect(parseRoute('#/stats')).toEqual({ name: 'stats' });
    expect(parseRoute('#/settings/')).toEqual({ name: 'settings' });
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

  it('reads a round to start at once', () => {
    expect(parseRoute('#/play/sorter/continue')).toEqual({
      name: 'game',
      gameId: 'sorter',
      intent: 'continue',
    });
    expect(parseRoute('#/play/kana/weakest')).toEqual({
      name: 'game',
      gameId: 'kana',
      intent: 'weakest',
    });
  });

  it('reports anything else as not found', () => {
    expect(parseRoute('#/play/quiz/extra')).toEqual({ name: 'not-found', path: 'play/quiz/extra' });
    expect(parseRoute('#/notebook/a/b')).toEqual({ name: 'not-found', path: 'notebook/a/b' });
    expect(parseRoute('#/nope')).toEqual({ name: 'not-found', path: 'nope' });
    expect(parseRoute('#/stats/extra')).toEqual({ name: 'not-found', path: 'stats/extra' });
  });

  it('builds hrefs that parse back', () => {
    expect(parseRoute(notebookHref('verbs-g1'))).toEqual({ name: 'notebook', deckId: 'verbs-g1' });
    expect(parseRoute(PLAY_HREF)).toEqual({ name: 'play' });
    expect(parseRoute(gameHref('quiz'))).toEqual({ name: 'game', gameId: 'quiz' });
    expect(parseRoute(gameHref('quiz', 'continue'))).toEqual({
      name: 'game',
      gameId: 'quiz',
      intent: 'continue',
    });
    expect(parseRoute(TODAY_HREF)).toEqual({ name: 'today' });
    expect(parseRoute(STATS_HREF)).toEqual({ name: 'stats' });
    expect(parseRoute(SETTINGS_HREF)).toEqual({ name: 'settings' });
  });
});
