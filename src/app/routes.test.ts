import { describe, expect, it } from 'vitest';
import { notebookHref, parseRoute } from './routes.ts';

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

  it('has a dev-only font tryout route', () => {
    expect(parseRoute('#/dev/fonts')).toEqual({ name: 'fonts' });
  });

  it('reports anything else as not found', () => {
    expect(parseRoute('#/play/quiz')).toEqual({ name: 'not-found', path: 'play/quiz' });
    expect(parseRoute('#/notebook/a/b')).toEqual({ name: 'not-found', path: 'notebook/a/b' });
  });

  it('builds hrefs that parse back', () => {
    expect(parseRoute(notebookHref('verbs-g1'))).toEqual({ name: 'notebook', deckId: 'verbs-g1' });
  });
});
