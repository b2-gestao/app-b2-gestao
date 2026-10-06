// Notas Fiscais: tokens e componentes visuais compartilhados pelas telas Cadastros e Título a Pagar.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

export type OpcaoSugestao = { value: string; label?: string };

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Campo de texto com lista de sugestões (no lugar do <datalist> nativo, que não aceita estilo).
 * A lista abre num portal com posição fixa para não ser cortada pelo overflow das tabelas.
 * onChange recebe um evento no formato { target: { value } }, igual ao do input.
 */
export function Sugestoes({ value, onChange, opcoes, ariaLabel, placeholder, inputMode, maxLength, altura = 34, estilo = '', invalido, porNome, padraoCodigo = /^\d*$/, disabled }: {
  value: string; onChange: (e: any) => void; opcoes: OpcaoSugestao[]; ariaLabel: string; placeholder?: string;
  inputMode?: 'numeric' | 'text'; maxLength?: number; altura?: number; estilo?: string; invalido?: boolean;
  /** Busca digitando o nome (mostra o nome primeiro); digitar só números continua valendo como código. */
  porNome?: boolean;
  /** Com porNome: o que vale como código digitado (padrão só números; itens do orçamento aceitam pontos). */
  padraoCodigo?: RegExp;
  disabled?: boolean;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  // Texto livre da busca por nome; null = o campo mostra o valor (código) do pai.
  const [busca, setBusca] = useState<string | null>(null);
  const termo = porNome && busca !== null ? busca : value;
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; max: number } | null>(null);

  const filtradas = useMemo(() => {
    const palavras = semAcento(termo.trim()).split(/\s+/).filter(Boolean);
    const lista = palavras.length
      ? opcoes.filter(o => { const alvo = semAcento(`${o.value} ${o.label || ''}`); return palavras.every(p => alvo.includes(p)); })
      : opcoes;
    return lista.slice(0, 80);
  }, [termo, opcoes]);

  const medir = () => {
    const el = campo.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 12;
    const acima = r.top - 12;
    const sobe = abaixo < 200 && acima > abaixo;
    const largura = Math.max(r.width, 300);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
    setPos(sobe
      ? { left, width: largura, bottom: window.innerHeight - r.top + 6, max: Math.min(300, acima) }
      : { left, width: largura, top: r.bottom + 6, max: Math.min(300, abaixo) });
  };

  useLayoutEffect(() => { if (aberto) medir(); }, [aberto, filtradas.length]);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: Event) => {
      // Rolar a própria lista não fecha; rolar a página, sim.
      if ((e.target as HTMLElement | null)?.closest?.('[data-sugestoes]')) return;
      setAberto(false);
    };
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', fechar, true); window.removeEventListener('resize', medir); };
  }, [aberto]);
  useEffect(() => { setAtivo(0); }, [termo]);
  useEffect(() => {
    if (!aberto) return;
    document.querySelector('[data-sugestoes] [data-ativo="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [ativo, aberto]);

  const escolher = (o: OpcaoSugestao) => { onChange({ target: { value: o.value } }); setBusca(null); setAberto(false); };
  const aoTeclar = (e: any) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!aberto) setAberto(true); else setAtivo(a => Math.min(a + 1, filtradas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && aberto && filtradas[ativo]) { e.preventDefault(); escolher(filtradas[ativo]); }
    else if (e.key === 'Escape' || e.key === 'Tab') setAberto(false);
  };

  return (
    <>
      <input ref={campo} value={porNome && busca !== null ? busca : value}
        onChange={e => {
          if (porNome) {
            // Só números = código (vai direto ao pai); qualquer letra = busca pelo nome, sem mexer no código.
            setBusca(e.target.value);
            if (padraoCodigo.test(e.target.value)) onChange(e);
          } else onChange(e);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)} onClick={() => setAberto(true)}
        onBlur={() => { setAberto(false); setBusca(null); }} onKeyDown={aoTeclar} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder}
        disabled={disabled} aria-label={ariaLabel} aria-invalid={invalido || undefined} aria-expanded={aberto} role="combobox" aria-autocomplete="list" autoComplete="off"
        style={css(input + `;height:${altura}px;${disabled ? 'background:#FAFAFB;cursor:not-allowed;' : ''}${estilo}`)} />
      {aberto && pos && filtradas.length && typeof document !== 'undefined' ? createPortal(
        <div data-sugestoes style={css(`position:fixed;z-index:200;left:${pos.left}px;width:${pos.width}px;${pos.top != null ? `top:${pos.top}px` : `bottom:${pos.bottom}px`};padding:1px;border-radius:12px;background:linear-gradient(135deg,rgba(65,97,255,.55),rgba(67,185,151,.4) 55%,rgba(65,97,255,.12));box-shadow:0 18px 40px -12px rgba(15,23,42,.28),0 4px 12px rgba(15,23,42,.08);animation:sugIn .14s ease-out both`)}
          onMouseDown={e => e.preventDefault()}>
          <style>{'@keyframes sugIn{from{opacity:0;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}'}</style>
          <div role="listbox" style={{ maxHeight: `${Math.max(140, pos.max)}px`, overflowY: 'auto', borderRadius: '11px', background: '#FFFFFF', padding: '5px' }}>
            {filtradas.map((o, i) => (
              <div key={o.value} role="option" aria-selected={i === ativo} data-ativo={i === ativo ? 1 : 0} onClick={() => escolher(o)} onMouseEnter={() => setAtivo(i)}
                style={css(`display:flex;align-items:baseline;gap:10px;padding:7px 10px;border-radius:7px;cursor:pointer;background:${i === ativo ? '#F2F5FF' : 'transparent'};transition:background .1s`)}>
                {porNome && o.label ? (
                  <>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: i === ativo ? '#3148B8' : '#111827', minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.label}>{o.label}</span>
                    <span style={{ fontSize: '11.5px', color: '#94A3B8', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{o.value}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: i === ativo ? '#3148B8' : '#111827', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{o.value}</span>
                    {o.label ? <span style={{ fontSize: '12px', color: '#64748B', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.label}>{o.label}</span> : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function LinhaAnexo({ descricao, onDescricao, sugestoes, max, nome, detalhe, principal, remover }: { descricao: string; onDescricao: any; sugestoes: OpcaoSugestao[]; max: number; nome: string; detalhe: string; principal?: boolean; remover?: () => void }) {
  const vazio = !descricao.trim();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 80px', gap: '12px', alignItems: 'center', padding: '10px 14px', boxShadow: principal ? 'none' : 'inset 0 1px 0 #F4F4F6' }}>
      <Sugestoes value={descricao} onChange={onDescricao} opcoes={sugestoes} maxLength={max} placeholder="Descrição *" ariaLabel="Descrição do anexo" invalido={vazio} altura={32} estilo={`font-weight:600;border-color:${vazio ? '#FCA5A5' : '#E7E7EA'}`} />
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
