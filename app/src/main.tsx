import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/ds-nocturne.css';
import './styles/theme.css';
import './styles/global.css';
import AuthGate from './auth/AuthGate';
import InstallPrompt from './InstallPrompt';
import { registerServiceWorker } from './pwa';
import { iniciarTema } from './lib/theme';

iniciarTema();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
    <InstallPrompt />
  </StrictMode>,
);
