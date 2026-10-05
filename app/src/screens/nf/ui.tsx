// Notas Fiscais: tokens e componentes visuais compartilhados pelas telas Cadastros e Título a Pagar.
import { useEffect, type ReactNode } from 'react';
import { css, hv } from '../../dc/runtime';
import { colHead, card, anim, input, btnPrim, btnPrimHover, btnSec, btnSecHover, off, link, TONS } from './estilo';

export function DocIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l4 4v14H6z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"></path>
      <path d="M15 3v4h4M9 12h7M9 16h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

export function Spinner({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin .9s linear infinite', flex: 'none' }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity=".3" strokeWidth="2.4"></circle>
      <path d="M21 12a9 9 0 00-9-9" stroke={color} strokeWidth="2.4" strokeLinecap="round"></path>
    </svg>
  );
}

export function Alerta({ tom, titulo, itens, children }: { tom: keyof typeof TONS; titulo: string; itens?: string[]; children?: ReactNode }) {
  const t = TONS[tom];
  return (
    <div style={{ padding: '12px 14px', borderRadius: '10px', background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, fontSize: '12.5px', lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: t.dot, flex: 'none' }}></span>
        {titulo}
      </div>
      {itens && itens.length ? (
        <ul style={{ margin: '6px 0 0', paddingLeft: '22px' }}>
          {itens.map(i => <li key={i}>{i}</li>)}
        </ul>
      ) : null}
      {children ? <div style={{ marginTop: '4px', paddingLeft: '15px' }}>{children}</div> : null}
    </div>
  );
}

export function Secao({ titulo, sub, acoes, children, delay = 0 }: { titulo: string; sub?: string; acoes?: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <section style={css(`${card};padding:18px 20px;display:flex;flex-direction:column;gap:14px;${anim(delay)}`)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#111827' }}>{titulo}</div>
          {sub ? <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{sub}</div> : null}
        </div>
        {acoes ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{acoes}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Campo({ rotulo, dica, largura = 1, children }: { rotulo: string; dica?: ReactNode; largura?: number; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: `span ${largura}`, minWidth: 0 }}>
      <span style={colHead}>{rotulo}</span>
      {children}
      {dica ? <span style={{ fontSize: '11.5px', color: '#94A3B8', lineHeight: 1.4 }}>{dica}</span> : null}
    </label>
  );
}

export function Leitura({ valor, detalhe }: { valor: string; detalhe?: string }) {
  return (
    <div style={{ minHeight: '38px', padding: '8px 12px', borderRadius: '8px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1', fontSize: '13px', color: '#111827', fontWeight: 500 }}>
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={valor}>{valor}</div>
      {detalhe ? <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '1px' }}>{detalhe}</div> : null}
    </div>
  );
}

export function Chip({ tom, children }: { tom: keyof typeof TONS; children: ReactNode }) {
  const t = TONS[tom];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '22px', padding: '0 9px', borderRadius: '20px', background: t.bg, color: t.fg, fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.dot }}></span>
      {children}
    </span>
  );
}

export function Resumo({ itens }: { itens: [string, string, string?][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px' }}>
      {itens.map(([rot, val, det]) => (
        <div key={rot} style={{ padding: '10px 12px', borderRadius: '9px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1', minWidth: 0 }}>
          <div style={colHead}>{rot}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={val}>{val}</div>
          {det ? <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '1px' }}>{det}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function LinhaAnexo({ descricao, onDescricao, max, nome, detalhe, principal, remover }: { descricao: string; onDescricao: any; max: number; nome: string; detalhe: string; principal?: boolean; remover?: () => void }) {
  const vazio = !descricao.trim();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 80px', gap: '12px', alignItems: 'center', padding: '10px 14px', boxShadow: principal ? 'none' : 'inset 0 1px 0 #F4F4F6' }}>
      <input value={descricao} onChange={onDescricao} list="nf-siglas-anexo" maxLength={max} placeholder="Descrição *" aria-invalid={vazio || undefined} style={css(input + `;height:32px;font-weight:600;border-color:${vazio ? '#FCA5A5' : '#E7E7EA'}`)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <DocIcon size={16} color={principal ? '#14B8A6' : '#94A3B8'} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nome}>{nome}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{detalhe}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {remover ? <button onClick={remover} style={css(link + ';color:#EF4444')}>remover</button> : null}
      </div>
    </div>
  );
}

/** Código da empresa no Sienge, quando o PDF não permitiu identificá-la pelo CNPJ nem pelo nome. */
export function EmpresaModal({ m, sub }: { m: any; sub: string }) {
  const bloqueado = m.enviando || !m.codigo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') m.fechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [m]);
  return (
    <div onClick={m.fechar} style={css('position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both')}>
      <div role="dialog" aria-modal="true" aria-label="Informar empresa" onClick={e => e.stopPropagation()}
        style={css('width:100%;max-width:420px;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both')}>
        <div style={{ padding: '18px 22px', boxShadow: 'inset 0 -1px 0 #F1F1F4' }}>
          <div style={{ fontWeight: 700, fontSize: '15.5px', color: '#111827' }}>Informar empresa</div>
          <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '3px' }}>{sub}</div>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (!bloqueado) m.confirmar(); }} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Campo rotulo="Código da empresa">
            <input value={m.codigo} onChange={m.onCodigo} disabled={m.enviando} inputMode="numeric" autoFocus placeholder="Ex.: 190" style={css(input)} />
          </Campo>
          {m.erro ? <Alerta tom="erro" titulo={m.erro} /> : null}
        </form>
        <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: '8px', boxShadow: 'inset 0 1px 0 #F1F1F4', background: '#FCFCFD' }}>
          <button onClick={m.fechar} disabled={m.enviando} style={css(btnSec + ';height:38px' + (m.enviando ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>Cancelar</button>
          <button onClick={m.confirmar} disabled={bloqueado} style={css(btnPrim + (bloqueado ? off : ''))} className={bloqueado ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
            {m.enviando ? <><Spinner /> Buscando…</> : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
