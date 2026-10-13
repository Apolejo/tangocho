import { gameById } from '../games/registry.ts';
import { LangProvider } from '../i18n/LangProvider.tsx';
import { GameScreen } from '../play/GameScreen.tsx';
import { PlayHub } from '../play/PlayHub.tsx';
import { NotFound } from '../screens/NotFound.tsx';
import { Notebook } from '../screens/notebook/Notebook.tsx';
import { Layout, type Section } from './Layout.tsx';
import type { Route } from './routes.ts';
import { useHashRoute } from './useHashRoute.ts';

function sectionOf(route: Route): Section {
  switch (route.name) {
    case 'notebook':
      return 'notebook';
    case 'play':
    case 'game':
      return 'play';
    case 'not-found':
      return undefined;
  }
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'notebook':
      return <Notebook deckId={route.deckId} />;
    case 'play':
      return <PlayHub />;
    case 'game': {
      const game = gameById(route.gameId);
      return game === undefined ? <NotFound /> : <GameScreen key={game.id} game={game} />;
    }
    case 'not-found':
      return <NotFound />;
  }
}

function Shell() {
  const route = useHashRoute();
  return (
    <Layout section={sectionOf(route)} reports={route.name === 'notebook' || route.name === 'play'}>
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
