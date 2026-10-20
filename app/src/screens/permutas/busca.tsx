// Permutas › Terrenos: campo de escolha com busca (empreendimento, unidade). Mostra o item escolhido e,
// ao clicar ou digitar, filtra a lista por palavras, sem acento. A lista abre num portal com posição
// fixa, para não ser cortada pela rolagem da modal. Setas + Enter escolhem; Esc fecha.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface OpcaoBusca { value: number; label: string; sub?: string; nota?: string; disabled?: boolean }

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LIMITE = 200;

export function SeletorBusca({ value, onChange, opcoes, placeholder = 'Digite para buscar…', vazio = 'Nada encontrado.', disabled, ariaLabel, altura = 36, buscaNoDetalhe = true }: {
  value: number | ''; onChange: (v: number | '') => void; opcoes: OpcaoBusca[]; placeholder?: string; vazio?: string;
  disabled?: boolean; ariaLabel: string; altura?: number;
  /** false: a busca olha só o nome (ex.: unidade, para "130" não trazer as de 130,00 m²). */
  buscaNoDetalhe?: boolean;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; max: number } | null>(null);
  const atual = opcoes.find(o => o.value === value);

  const filtradas = useMemo(() => {
    const termo = semAcento(q.trim());
    const palavras = termo.split(/\s+/).filter(Boolean);
    if (!palavras.length) return opcoes.slice(0, LIMITE);
    const l = opcoes.filter(o => {
      const alvo = semAcento(buscaNoDetalhe ? `${o.label} ${o.sub || ''}` : o.label);
      return palavras.every(p => alvo.includes(p));
    });
    // O que começa pelo texto digitado vem primeiro (1301, 1302… antes de 103).
    const comeca = (o: OpcaoBusca) => (semAcento(o.label).startsWith(termo) ? 0 : 1);
    return l.map((o, i) => [o, i] as const).sort((a, b) => comeca(a[0]) - comeca(b[0]) || a[1] - b[1]).map(x => x[0]).slice(0, LIMITE);
  }, [q, opcoes, buscaNoDetalhe]);

  const medir = () => {
    const el = campo.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 12, acima = r.top - 12;
    const sobe = abaixo < 220 && acima > abaixo;
    const width = Math.max(r.width, 260);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos(sobe ? { left, width, bottom: window.innerHeight - r.top + 6, max: Math.min(300, acima) } : { left, width, top: r.bottom + 6, max: Math.min(300, abaixo) });
  };
  useLayoutEffect(() => { if (aberto) medir(); }, [aberto, filtradas.length]);
  useEffect(() => {
    if (!aberto) return;
    // Rolar a própria lista não fecha; rolar a modal ou a página, sim.
    const fechar = (e: Event) => { if ((e.target as HTMLElement | null)?.closest?.('[data-pm-busca]')) return; setAberto(false); };
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', fechar, true); window.removeEventListener('resize', medir); };
  }, [aberto]);
  useEffect(() => { setAtivo(Math.max(0, filtradas.findIndex(o => !o.disabled))); }, [q, aberto]);
  useEffect(() => { if (aberto) document.querySelector('[data-pm-busca] [data-ativo="1"]')?.scrollIntoView({ block: 'nearest' }); }, [ativo, aberto]);

  const escolher = (o: OpcaoBusca) => {
    if (o.disabled) return;
    onChange(o.value); setAberto(false); setQ(''); campo.current?.blur();
  };
  const mover = (d: number) => setAtivo(a => {
    let i = a;
    for (let k = 0; k < filtradas.length; k++) { i = (i + d + filtradas.length) % filtradas.length; if (!filtradas[i].disabled) return i; }
    return a;
  });

  return (
    <>
      <span className="pm-busca">
        <input ref={campo} className="pm-in" style={{ height: altura + 'px', paddingRight: '30px' }} disabled={disabled} aria-label={ariaLabel}
          role="combobox" aria-expanded={aberto} aria-autocomplete="list" autoComplete="off"
          placeholder={atual ? atual.label : placeholder}
          value={aberto ? q : atual ? atual.label + (atual.sub ? ` · ${atual.sub}` : '') : ''}
          onFocus={() => { setAberto(true); setQ(''); }}
          onClick={() => setAberto(true)}
          onBlur={() => { setAberto(false); setQ(''); }}
          onChange={e => { setQ(e.target.value); setAberto(true); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!aberto) setAberto(true); else mover(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
            else if (e.key === 'Enter' && aberto && filtradas[ativo]) { e.preventDefault(); escolher(filtradas[ativo]); }
            else if (e.key === 'Escape' && aberto) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setAberto(false); campo.current?.blur(); }
          }} />
        <svg className="pm-busca-ic" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="6.5" stroke="#94A3B8" strokeWidth="1.8" />
          <path d="M16 16l4 4" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      {aberto && pos && typeof document !== 'undefined' ? createPortal(
        <div data-pm-busca className="pm-busca-pan" onMouseDown={e => e.preventDefault()}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}>
          <div className="pm-busca-list" role="listbox" style={{ maxHeight: Math.max(140, pos.max) + 'px' }}>
            {filtradas.length ? filtradas.map((o, i) => (
              <div key={o.value} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined} data-ativo={i === ativo ? 1 : 0}
                className={'pm-busca-i' + (o.value === value ? ' sel' : '') + (i === ativo ? ' at' : '') + (o.disabled ? ' off' : '')}
                onMouseEnter={() => { if (!o.disabled) setAtivo(i); }} onClick={() => escolher(o)}>
                <span className="nm">{o.label}</span>
                {o.nota ? <span className="nota">{o.nota}</span> : null}
                {o.sub ? <span className="sub">{o.sub}</span> : null}
              </div>
            )) : <div className="pm-hint" style={{ padding: '10px' }}>{vazio}</div>}
          </div>
          {opcoes.length > LIMITE && filtradas.length === LIMITE ? <div className="pm-busca-mais">Mostrando {LIMITE} de {opcoes.length}. Digite para filtrar.</div> : null}
        </div>, document.body) : null}
    </>
  );
}
