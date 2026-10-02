// CRC › Entregas: o "Habitat · Gestão de Entrega" (HTML avulso) dentro do sistema.
// Not generated from the prototype. A tela é a do HTML, com o mesmo markup e a mesma lógica
// (entregas.markup.html + entregas.legacy.js), montada uma vez num elemento .crc-ent que fica
// guardado entre as visitas; os dados vêm do Supabase por crcStore.ts. Logic: logic/vals/crcEntregas.ts.
import { useEffect, useRef, useState } from 'react';
import { crcStore } from './crcStore';

const w = window as any;

export default function CrcEntregasPage({ v }: { v: any }) {
  const ativo = !!v.isCrcEntregas;
  const host = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [erro, setErro] = useState('');

  // O script lê estes dados quando precisa (empresas, permissão e nome mudam depois do login).
  const crc = v.crc;
  useEffect(() => {
    if (crc) crcStore.ctx = crc;
  });

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    setEstado(w.__crcRoot ? 'ok' : 'carregando');
    if (!w.XLSX) import('xlsx').then(m => { w.XLSX = m; }).catch(() => {});
    (async () => {
      try {
        if (w.__crcRoot) {
          host.current?.appendChild(w.__crcRoot);
          await crcStore.recarregar();
          return;
        }
        // Markup, script e CSS só baixam quando a tela é aberta (fora do bundle principal).
        const [db, { default: markup }, { default: legacy }] = await Promise.all([
          crcStore.carregar(),
          import('./entregas.markup.html?raw'),
          import('./entregas.legacy.js?raw'),
          import('./entregas.css'),
        ]);
        if (cancelado || !host.current) return;
        const root = document.createElement('div');
        root.className = 'crc-ent';
        root.innerHTML = markup;
        host.current.appendChild(root);
        w.__crcRoot = root;
        crcStore.inicial = db;
        // Script clássico: as funções ficam globais para os onclick="..." do markup.
        const s = document.createElement('script');
        s.textContent = legacy;
        document.body.appendChild(s);
        if (!cancelado) setEstado('ok');
      } catch (e: any) {
        if (!cancelado) { setErro(e?.message || String(e)); setEstado('erro'); }
      }
    })();
    // Volta para a aba: traz o que outros usuários gravaram (sem atrapalhar modal aberto).
    const aoFocar = () => {
      if (Date.now() - crcStore.ultimaCarga < 30000) return;
      if (w.__crcRoot?.querySelector('.modal-backdrop.show')) return;
      crcStore.recarregar();
    };
    window.addEventListener('focus', aoFocar);
    return () => {
      cancelado = true;
      window.removeEventListener('focus', aoFocar);
      crcStore.descarregar();
      const root = w.__crcRoot as HTMLElement | undefined;
      if (root?.parentNode) root.parentNode.removeChild(root);
    };
  }, [ativo]);

  if (!ativo) return null;
  return (
    <main style={{ flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {estado === 'carregando' ? (
        <div className="crc-boot"><b>Carregando Entregas…</b><span>Projetos, ações e histórico do comitê</span></div>
      ) : null}
      {estado === 'erro' ? (
        <div className="crc-boot erro"><b>Não foi possível abrir CRC › Entregas</b><span>{erro}</span></div>
      ) : null}
      <div ref={host} style={{ flex: '1', minHeight: '0', display: estado === 'ok' ? 'flex' : 'none', flexDirection: 'column' }} />
    </main>
  );
}
