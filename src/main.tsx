import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/klee-one/400.css';
import '@fontsource/klee-one/600.css';
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/700.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
