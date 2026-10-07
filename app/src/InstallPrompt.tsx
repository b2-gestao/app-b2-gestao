import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = 'b2.pwa.dismissed';

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// Botão discreto "Instalar aplicativo": só aparece quando o navegador permite a instalação.
export default function InstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isDismissed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!evt) return null;

  const install = async () => {
    await evt.prompt();
    await evt.userChoice;
    setEvt(null);
  };
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignora */
    }
    setEvt(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px 10px 14px', background: '#18181B', color: '#F5F5F7', border: '1px solid #2A2A30',
        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.35)', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span>Instalar o B2 Gestão neste computador</span>
      <button
        onClick={install}
        style={{ background: '#4161FF', color: '#fff', border: 0, borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Instalar
      </button>
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        style={{ background: 'transparent', color: '#A1A1AA', border: 0, fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 2 }}
      >
        ×
      </button>
    </div>
  );
}
