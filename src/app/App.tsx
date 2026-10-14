import { useEffect, useRef } from 'react';
import { gameById } from '../games/registry.ts';
import type { MessageKey } from '../i18n/en.ts';
import { useT } from '../i18n/hooks.ts';
import { LangProvider } from '../i18n/LangProvider.tsx';
import { GameScreen } from '../play/GameScreen.tsx';
import { PlayHub } from '../play/PlayHub.tsx';
import { NotFound } from '../screens/NotFound.tsx';
import { Notebook } from '../screens/notebook/Notebook.tsx';
import { Settings } from '../screens/settings/Settings.tsx';
import { Stats } from '../screens/stats/Stats.tsx';
import { Today } from '../screens/today/Today.tsx';
import { focusScreenHeading } from './focus.ts';
import { Layout, type Section } from './Layout.tsx';
import type { Route } from './routes.ts';
import { useHashRoute } from './useHashRoute.ts';

function sectionOf(route: Route): Section {
  switch (route.name) {
    case 'today':
    case 'notebook':
    case 'stats':
    case 'settings':
      return route.name;
    case 'play':
    case 'game':
      return 'play';
    case 'not-found':
      return undefined;
  }
}

/** The screen a route shows: the notebook's deck and a game's start intent don't change it. */
function screenOf(route: Route): string {
  return route.name === 'game' ? `game:${route.gameId}` : route.name;
}

const SCREEN_NAMES: Record<Exclude<Route['name'], 'game'>, MessageKey> = {
  today: 'nav_today',
  notebook: 'nav_notebook',
  play: 'nav_play',
  stats: 'nav_stats',
  settings: 'nav_settings',
  'not-found': 'not_found',
};

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'today':
      return <Today />;
    case 'notebook':
      return <Notebook deckId={route.deckId} />;
    case 'stats':
      return <Stats />;
    case 'settings':
      return <Settings />;
    case 'play':
      return <PlayHub />;
    case 'game': {
      const game = gameById(route.gameId);
      // keyed by game only: dropping the intent from the address keeps the round going
      return game === undefined ? (
        <NotFound />
      ) : (
        <GameScreen key={game.id} game={game} {...(route.intent && { intent: route.intent })} />
      );
    }
    case 'not-found':
      return <NotFound />;
  }
}

function Shell() {
  const t = useT();
  const route = useHashRoute();
  const screen = screenOf(route);

  // a new screen takes the focus at its heading (SPEC §8.3); the first one is left to the browser
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    focusScreenHeading();
  }, [screen]);

  const game = route.name === 'game' ? gameById(route.gameId) : undefined;
  const title =
    route.name === 'game'
      ? game === undefined
        ? t('not_found')
        : t(game.nameKey)
      : t(SCREEN_NAMES[route.name]);
  useEffect(() => {
    document.title = `${title} · 単語帳 ${t('appName')}`;
  }, [title, t]);

  return (
    <Layout
      section={sectionOf(route)}
      banners={route.name === 'today' || route.name === 'notebook' || route.name === 'play'}
    >
      <Screen route={route} />
    </Layout>
  );
}

export function App() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  );
}
