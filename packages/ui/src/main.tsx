import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts bundled locally (offline-capable); no CDN.
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles/tokens.css';
import './styles/app.css';
import { PrefsProvider } from './i18n/PrefsProvider';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsProvider>
      <App />
    </PrefsProvider>
  </StrictMode>,
);
