import { Suspense, lazy } from 'react';
import { LangProvider } from '../i18n/LangProvider.tsx';
import { NotFound } from '../screens/NotFound.tsx';
import { Notebook } from '../screens/notebook/Notebook.tsx';
import { Layout } from './Layout.tsx';
import { useHashRoute } from './useHashRoute.ts';

// dev only: the font tryout page (SPEC §13, final choice from screenshots); never in the build
const FontTryout = import.meta.env.DEV ? lazy(() => import('../screens/dev/FontTryout.tsx')) : null;

function Screen() {
  const route = useHashRoute();
  switch (route.name) {
    case 'notebook':
      return <Notebook deckId={route.deckId} />;
    case 'fonts':
      return FontTryout === null ? (
        <NotFound />
      ) : (
        <Suspense fallback={null}>
          <FontTryout />
        </Suspense>
      );
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
