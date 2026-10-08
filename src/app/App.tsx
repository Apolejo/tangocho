import { LangProvider } from '../i18n/LangProvider.tsx';
import { NotFound } from '../screens/NotFound.tsx';
import { Notebook } from '../screens/notebook/Notebook.tsx';
import { Layout } from './Layout.tsx';
import { useHashRoute } from './useHashRoute.ts';

function Screen() {
  const route = useHashRoute();
  switch (route.name) {
    case 'notebook':
      return <Notebook deckId={route.deckId} />;
    case 'not-found':
      return <NotFound />;
  }
}

export function App() {
  return (
    <LangProvider>
      <Layout>
        <Screen />
      </Layout>
    </LangProvider>
  );
}
