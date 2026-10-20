// Permutas › Terrenos: peças comuns às telas Cadastros, Visão Geral e Insights.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { baixarArquivo } from '../../lib/download';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const Chev = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export interface Opcao { value: string; label: string; sub?: string }

/** Filtro de escolha única com busca (mesmo visual do seletor de empresa do B2). */
export function FiltroBusca({ value, onChange, opcoes, todos = 'Todas', placeholder = 'Buscar…' }: {
  value: string; onChange: (v: string) => void; opcoes: Opcao[]; todos?: string; placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  const termo = semAcento(q.trim());
  const lista: Opcao[] = [{ value: '', label: todos }, ...opcoes.filter(o => !termo || semAcento(`${o.label} ${o.sub || ''}`).includes(termo))];
  const atual = opcoes.find(o => o.value === value);
  const escolher = (v: string) => { onChange(v); setAberto(false); setQ(''); };
  return (
    <div className="pm-dd" ref={caixa}>
      <button type="button" className={'pm-dd-btn' + (aberto ? ' open' : '')} style={{ height: '36px' }} aria-haspopup="listbox" aria-expanded={aberto}
        onClick={() => { setAberto(!aberto); setQ(''); setAtivo(0); }}>
        <span className="v">{atual ? atual.label : todos}</span><Chev />
      </button>
      {aberto ? (
        <div className="pm-dd-pan" style={{ minWidth: '280px' }}>
          <input className="pm-dd-q" autoFocus placeholder={placeholder} value={q}
            onChange={e => { setQ(e.target.value); setAtivo(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, lista.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter' && lista[ativo]) { e.preventDefault(); escolher(lista[ativo].value); }
              else if (e.key === 'Escape') setAberto(false);
            }} />
          <div className="pm-dd-list" role="listbox">
            {lista.length > 1 || !termo ? lista.map((o, i) => (
              <div key={o.value || '_todos'} role="option" aria-selected={o.value === value}
                className={'pm-dd-i' + (o.value === value ? ' sel' : '')} style={i === ativo && o.value !== value ? { background: '#F4F4F6' } : undefined}
                onMouseEnter={() => setAtivo(i)} onClick={() => escolher(o.value)}>
                <span className="nm">{o.label}{o.sub ? <span className="sub"> – {o.sub}</span> : null}</span>
              </div>
            )) : <div className="pm-hint" style={{ padding: '8px 10px' }}>Nada encontrado.</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface Coluna { key: string; label: ReactNode; w: number; num?: boolean; min?: number }

/** Larguras das colunas, ajustáveis arrastando a borda do cabeçalho; ficam guardadas no navegador. */
export function useColunas(chave: string, cols: Coluna[]) {
  const ler = () => {
    try { const s = JSON.parse(localStorage.getItem('pm-cols-' + chave) || 'null'); if (s && typeof s === 'object') return s as Record<string, number>; } catch { /* sem armazenamento */ }
    return {} as Record<string, number>;
  };
  const [larg, setLarg] = useState<Record<string, number>>(ler);
  const w = (c: Coluna) => larg[c.key] || c.w;
  const salvar = (n: Record<string, number>) => { setLarg(n); try { localStorage.setItem('pm-cols-' + chave, JSON.stringify(n)); } catch { /* sem armazenamento */ } };
  const template = cols.map(c => w(c) + 'px').join(' ');
  const total = cols.reduce((s, c) => s + w(c), 0) + (cols.length - 1) * 12 + 36;
  const arrastar = (c: Coluna) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = w(c);
    let atual = { ...larg };
    const mover = (ev: MouseEvent) => { atual = { ...atual, [c.key]: Math.max(c.min || 60, Math.round(w0 + ev.clientX - x0)) }; setLarg(atual); };
    const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); document.body.style.cursor = ''; salvar(atual); };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
  };
  const resetar = (c: Coluna) => () => { const n = { ...larg }; delete n[c.key]; salvar(n); };
  const cabecalho = (
    <div className="pm-tr hd" style={{ gridTemplateColumns: template, minWidth: total }}>
      {cols.map(c => (
        <span key={c.key} className={'pm-th' + (c.num ? ' pm-n' : '')}>
          <span className="pm-ell">{c.label}</span>
          <span className="pm-rz" role="separator" aria-orientation="vertical" title="Arraste para ajustar a largura (duplo clique volta ao padrão)"
            onMouseDown={arrastar(c)} onDoubleClick={resetar(c)} />
        </span>
      ))}
    </div>
  );
  return { template, total, cabecalho, estilo: { gridTemplateColumns: template, minWidth: total } as React.CSSProperties };
}

/** Planilha .xlsx com cabeçalho em negrito e larguras pelo conteúdo. */
export async function exportarExcel(nome: string, aba: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const XLSX = await import('xlsx');
  const dados = [cabecalho, ...linhas.map(l => l.map(v => (v == null ? '' : v)))];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws['!cols'] = cabecalho.map((_, i) => ({ wch: Math.min(60, Math.max(10, ...dados.map(l => String(l[i] ?? '').length + 2))) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dados.length - 1, c: cabecalho.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31));
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  baixarArquivo(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome);
}

export const IcExcel = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M6 3h9l4 4v14H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9.5 11l4 5M13.5 11l-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Paginação das listas: página fixa (a primeira opção) com troca de tamanho e "Mostrar todos". */
export function usePaginacao<T>(itens: T[], tamanhos: readonly number[], reiniciar: unknown[]) {
  const [porPag, setPorPag] = useState<number>(tamanhos[0]); // 0 = mostrar todos
  const [pag, setPag] = useState(1);
  useEffect(() => { setPag(1); }, [...reiniciar, porPag]);
  const total = itens.length;
  const tam = porPag || Math.max(total, 1);
  const nPag = Math.max(1, Math.ceil(total / tam));
  const pagAtual = Math.min(pag, nPag);
  const visiveis = porPag ? itens.slice((pagAtual - 1) * tam, pagAtual * tam) : itens;
  return { visiveis, total, tam, nPag, pag: pagAtual, setPag, porPag, setPorPag, tamanhos };
}

export function Paginacao({ pg, rotulo = 'itens' }: { pg: Omit<ReturnType<typeof usePaginacao>, 'visiveis'>; rotulo?: string }) {
  if (pg.total <= pg.tamanhos[0] && pg.porPag !== 0) return null;
  return (
    <div className="pm-pag">
      <span>{pg.porPag ? `${(pg.pag - 1) * pg.tam + 1}–${Math.min(pg.pag * pg.tam, pg.total)}` : pg.total} de {pg.total} {rotulo}</span>
      <div className="ctl">
        {pg.porPag ? (
          <>
            <button type="button" className="pm-btn sm" disabled={pg.pag <= 1} onClick={() => pg.setPag(pg.pag - 1)}>Anterior</button>
            <em>Página {pg.pag} de {pg.nPag}</em>
            <button type="button" className="pm-btn sm" disabled={pg.pag >= pg.nPag} onClick={() => pg.setPag(pg.pag + 1)}>Próxima</button>
          </>
        ) : null}
        {pg.tamanhos.map(n => <button key={n} type="button" className={'pm-seg' + (pg.porPag === n ? ' on' : '')} onClick={() => pg.setPorPag(n)}>{n} por página</button>)}
        <button type="button" className={'pm-seg' + (pg.porPag === 0 ? ' on' : '')} onClick={() => pg.setPorPag(0)}>Mostrar todos</button>
      </div>
    </div>
  );
}
