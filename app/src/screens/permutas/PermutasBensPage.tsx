// Permutas › Bens: transfere o usuário para a plataforma externa de gestão de permutas.
import { useEffect } from 'react';

const URL_BENS = 'https://gestaopermutas.habitatincorporadora.com/';
const ATRASO_MS = 1200;

export default function PermutasBensPage({ v }: { v: any }) {
  const ativo = !!v.isPermutasBens;

  useEffect(() => {
    if (!ativo) return;
    const t = window.setTimeout(() => { window.location.assign(URL_BENS); }, ATRASO_MS);
    return () => window.clearTimeout(t);
  }, [ativo]);

  if (!ativo) return null;
  return (
    <div role="status" aria-live="polite" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(161,161,170,.25)', borderTopColor: '#4161FF', animation: 'spin .8s linear infinite' }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F7' }}>Estamos te transferindo para a plataforma externa.</div>
      <div style={{ fontSize: 13, color: '#A1A1AA' }}>Aguarde.</div>
    </div>
  );
}
