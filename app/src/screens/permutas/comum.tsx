// Permutas › Terrenos: contexto vindo da lógica do app, KPI, nomes e a modal ligada ao store.
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Permuta, PermutaAnexo, UnidadeCatalogo } from '../../lib/permutas';
import PermutaModal, { type EmpresaOpcao } from './PermutaModal';
import { permutasStore, usePermutas } from './store';

export type PaginaPermutas = 'cadastros' | 'visao' | 'insights';
export interface PermutasCtx {
  pagina: PaginaPermutas | null;
  live: boolean;
  toast: (m: string) => void;
  podeEditar: () => boolean;
  empresas: () => EmpresaOpcao[];
  ir: (p: PaginaPermutas) => void;
}

export const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Contexto da tela, dados do store (carregados na primeira abertura) e nomes para exibição. */
export function useBasePermutas(v: any, pagina: PaginaPermutas) {
  const ctx: PermutasCtx | undefined = v.permutas;
  const ativo = ctx?.pagina === pagina;
  const live = !!ctx?.live;
  const dados = usePermutas();
  useEffect(() => { if (ativo) permutasStore.carregar(live); }, [ativo, live]);
  const empresasCtx = ctx?.empresas;
  const empresas = useMemo(() => {
    return empresasCtx ? empresasCtx() : [];
  }, [empresasCtx]);
  const nomeOrigem = (p: Permuta) => p.empresa_id != null
    ? (empresas.find(e => e.id === p.empresa_id)?.nome || `Empresa ${p.empresa_id}`)
    : (dados.negocios.find(n => n.id === p.negocio_id)?.nome || 'Negócio');
  const empInfo = useMemo(() => {
    const m = new Map<number, UnidadeCatalogo>();
    dados.catalogo.forEach(u => { if (!m.has(u.enterprise_id)) m.set(u.enterprise_id, u); });
    return m;
  }, [dados.catalogo]);
  const nomeEmp = (enterprise_id: number) => empInfo.get(enterprise_id)?.empreendimento || `Empreendimento ${enterprise_id}`;
  // Empreendimento(s) da empresa Sienge: o cadastro da empresa e, na falta dele, o catálogo de unidades.
  const empsPorEmpresa = useMemo(() => {
    const m = new Map<number, Set<string>>();
    dados.catalogo.forEach(u => {
      const nome = u.empreendimento?.trim();
      if (u.company_id == null || !nome) return;
      if (!m.has(u.company_id)) m.set(u.company_id, new Set());
      m.get(u.company_id)!.add(nome);
    });
    return m;
  }, [dados.catalogo]);
  const empDaOrigem = (p: Permuta): string | null => {
    if (p.empresa_id == null) return null;
    const cad = empresas.find(e => e.id === p.empresa_id)?.emp?.trim();
    if (cad) return cad;
    const cat = empsPorEmpresa.get(p.empresa_id);
    return cat && cat.size ? [...cat].sort((a, b) => a.localeCompare(b)).join(', ') : null;
  };
  return { ctx, ativo, live, dados, empresas, nomeOrigem, nomeEmp, empInfo, empDaOrigem };
}

export function Kpi({ cor, fundo, rotulo, valor, un, sub, icone, onClick, ativo }: {
  cor?: string; fundo: string; rotulo: string; valor: string; un?: string; sub: string; icone: ReactNode; onClick?: () => void; ativo?: boolean;
}) {
  return (
    <div className={'pm-kpi' + (onClick ? ' clic' : '') + (ativo ? ' on' : '')} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="h"><span className="pm-ic" style={{ background: fundo }}>{icone}</span><span className="pm-cap">{rotulo}</span></div>
      <div className="v" style={cor ? { color: cor } : undefined}>{valor}{un ? <small>{un}</small> : null}</div>
      <div className="d">{sub.charAt(0).toUpperCase() + sub.slice(1)}</div>
    </div>
  );
}

/** Modal de permuta ligada ao store (usada em Cadastros e Visão Geral). */
export function ModalPermutaStore({ permuta, ctx, empresas, fechar }: { permuta: Permuta | null; ctx: PermutasCtx; empresas: EmpresaOpcao[]; fechar: () => void }) {
  const d = usePermutas();
  const historico = useCallback((id: string) => permutasStore.historico(id), []);
  const baixar = async (a: PermutaAnexo) => {
    try {
      const url = await permutasStore.link(a);
      if (!url) { ctx.toast('No modo demonstração os arquivos não são guardados.'); return; }
      window.open(url, '_blank', 'noopener');
    } catch (e: any) { ctx.toast(e?.message || String(e)); }
  };
  // Versão atual do store: reflete inativação/reativação feita com a modal aberta.
  const atual = permuta ? d.permutas.find(x => x.id === permuta.id) || permuta : null;
  return (
    <PermutaModal
      permuta={atual} empresas={empresas} negocios={d.negocios} catalogo={d.catalogo} podeEditar={ctx.podeEditar()}
      toast={ctx.toast} salvar={(...a) => permutasStore.salvar(...a)} excluir={p => permutasStore.excluir(p)} baixar={baixar}
      definirStatus={(...a) => permutasStore.definirStatus(...a)} definirStatusUnidade={(...a) => permutasStore.definirStatusUnidade(...a)}
      historico={historico} fechar={fechar}
      permutas={d.permutas} lerContrato={f => permutasStore.lerContrato(f)} precos={(i, dt) => permutasStore.precos(i, dt)}
    />
  );
}

export const IcPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" /></svg>
);
