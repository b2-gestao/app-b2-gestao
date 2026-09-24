// BI › painel: relatório do Power BI publicado na web, aberto num iframe.
// Not generated from the prototype; follows the look of the Financeiro pages. Logic: logic/vals/bi.ts.
import { useEffect, useRef, useState } from 'react';
import { css, hv } from '../dc/runtime';

// Height of the Power BI bottom bar (share, zoom, logo). The iframe is this much taller and
// the card clips it, when the painel has "ocultar rodapé" on.
const PBI_FOOTER = 56;

const toolBtn = 'display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#374151;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,transform .15s';
const toolHover = 'background:#F4F4F6;border-color:#D8D8E0';

function BarsIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 20v-7M10 20V8M15 20v-5M20 20V4" stroke={color} strokeWidth="1.9" strokeLinecap="round"></path>
    </svg>
  );
}

export default function BiPage({ v }: { v: any }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === cardRef.current && !!cardRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!v.isBi) return null;
  const p = v.biPainel;

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else cardRef.current?.requestFullscreen?.();
  };

  return (
    <main style={css('flex:1;min-height:0;overflow-y:auto;padding:20px 32px 28px;display:flex;flex-direction:column;gap:14px')}>
      <div style={css('display:flex;align-items:center;gap:16px;flex-wrap:wrap;opacity:0;animation:fadeInUp .45s ease-out both')}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: '20px', color: '#111827', letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {v.biTitle}
            </div>
            {p ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 10px', borderRadius: '20px', background: '#FEF7D6', color: '#8A6A00', fontSize: '11.5px', fontWeight: 600 }}>
                <BarsIcon size={12} color="#C9A200" />
                Power BI
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px' }}>{v.biCountLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {p ? (
            <>
              <button onClick={v.reloadBi} title="Recarregar o painel" style={css(toolBtn)} className={hv(toolHover, 'transform:scale(.97)', undefined)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                Recarregar
              </button>
              <button onClick={v.openBiNewTab} title="Abrir o relatório numa nova aba" style={css(toolBtn)} className={hv(toolHover, 'transform:scale(.97)', undefined)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                Nova aba
              </button>
              <button onClick={toggleFull} title={full ? 'Sair da tela cheia' : 'Tela cheia'} style={css(toolBtn)} className={hv(toolHover, 'transform:scale(.97)', undefined)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                Tela cheia
              </button>
            </>
          ) : null}
          {v.canManageBi ? (
            <button onClick={v.openBiCfg} title="Gerenciar painéis" style={css(toolBtn + ';width:36px;padding:0;justify-content:center')} className={hv(toolHover, 'transform:scale(.97)', undefined)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"></circle>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div ref={cardRef} style={css(`position:relative;flex:1 1 auto;min-height:480px;border-radius:${full ? 0 : 12}px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03);overflow:hidden;opacity:0;animation:fadeInUp .5s ease-out both;animation-delay:.06s`)}>
        {p ? (
          <>
            <iframe
              key={v.biFrameKey}
              src={p.url}
              title={p.nome}
              onLoad={v.onBiLoad}
              allowFullScreen
              referrerPolicy="no-referrer"
              style={css(`position:absolute;top:0;left:0;width:100%;height:${p.ocultar_rodape ? `calc(100% + ${PBI_FOOTER}px)` : '100%'};border:none;background:#FFFFFF;opacity:${v.biLoaded ? 1 : 0};transition:opacity .4s ease`)}
            />
            {!v.biLoaded ? (
              <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#FFFFFF')}>
                <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 6px rgba(65,97,255,.06)' }}>
                  <BarsIcon size={22} color="#4161FF" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Carregando painel</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{p.nome}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={css(`width:7px;height:7px;border-radius:50%;background:#4161FF;animation:blink 1.1s ease-in-out infinite;animation-delay:${i * 0.18}s`)}></span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;text-align:center')}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#F4F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarsIcon size={24} color="#94A3B8" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>Nenhum painel disponível</div>
            <div style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '440px', lineHeight: 1.55 }}>
              {v.canManageBi
                ? 'Cadastre o link público de um relatório do Power BI (Arquivo › Inserir relatório › Publicar na Web). Cada painel vira um item do menu BI.'
                : 'Nenhum painel de BI foi liberado para o seu perfil. Fale com o administrador do sistema.'}
            </div>
            {v.canManageBi ? (
              <button onClick={v.openBiCfg} style={css('display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 18px;margin-top:4px;border:none;border-radius:9px;background:#4161FF;color:#FFFFFF;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(65,97,255,.26);transition:background .15s,transform .15s')} className={hv('background:#3153F4', 'transform:scale(.97)', undefined)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                </svg>
                Cadastrar painel
              </button>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
