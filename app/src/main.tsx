import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/ds-nocturne.css';
import './styles/global.css';
import AuthGate from './auth/AuthGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
