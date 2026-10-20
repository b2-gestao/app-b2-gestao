// Permutas › Terrenos: dados compartilhados pelas telas Cadastros, Visão Geral e Insights.
// Carrega uma vez (ou de novo com recarregar()) e avisa as telas a cada mudança.
// Sem Supabase (modo demonstração) as telas abrem vazias e o que for cadastrado fica só em memória.
import { useSyncExternalStore } from 'react';
import {
  permutasApi,
  type AnexoNovo, type EmpreendimentoFicha, type Negocio, type Permuta, type PermutaAnexo, type PermutaDados,
  type PermutaUnidade, type UnidadeCatalogo, type UnidadeDireta,
} from '../../lib/permutas';

export interface EstadoPermutas {
  carregado: boolean;
  carregando: boolean;
  erro: string;
  permutas: Permuta[];
  negocios: Negocio[];
  catalogo: UnidadeCatalogo[];
  fichas: EmpreendimentoFicha[];
  diretas: UnidadeDireta[];
}

let estado: EstadoPermutas = { carregado: false, carregando: false, erro: '', permutas: [], negocios: [], catalogo: [], fichas: [], diretas: [] };
let live = false;
const ouvintes = new Set<() => void>();
const set = (p: Partial<EstadoPermutas>) => { estado = { ...estado, ...p }; ouvintes.forEach(f => f()); };
const porNome = <T extends { nome: string }>(l: T[]) => [...l].sort((a, b) => a.nome.localeCompare(b.nome));
const novoId = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function usePermutas(): EstadoPermutas {
  return useSyncExternalStore(cb => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; }, () => estado);
}

async function buscarTudo() {
  const [r, u, v] = await Promise.all([permutasApi.carregar(), permutasApi.unidades(), permutasApi.visaoGeral()]);
  set({ permutas: r.permutas, negocios: r.negocios, catalogo: u, fichas: v.fichas, diretas: v.diretas });
}
async function recarregarBase() {
  const [r, v] = await Promise.all([permutasApi.carregar(), permutasApi.visaoGeral()]);
  set({ permutas: r.permutas, negocios: r.negocios, fichas: v.fichas, diretas: v.diretas });
}

export const permutasStore = {
  get estado() { return estado; },

  /** Primeira carga (as telas chamam ao abrir; só busca uma vez). */
  async carregar(emLive: boolean) {
    live = emLive;
    if (estado.carregado || estado.carregando) return;
    set({ carregando: true, erro: '' });
    try {
      if (live) await buscarTudo();
      set({ carregado: true, carregando: false });
    } catch (e: any) {
      set({ erro: e?.message || String(e), carregando: false });
    }
  },
  /** Traz o que outros usuários gravaram. */
  async recarregar() {
    if (!live) return;
    try { await recarregarBase(); set({ erro: '' }); } catch (e: any) { set({ erro: e?.message || String(e) }); }
  },

  // ---------- permutas ----------
  async salvar(id: string | null, dados: PermutaDados, unidades: PermutaUnidade[], novos: AnexoNovo[], removidos: PermutaAnexo[]) {
    if (live) { await permutasApi.salvar(id, dados, unidades, novos, removidos); await recarregarBase(); return; }
    const anexosNovos: PermutaAnexo[] = novos.map(a => ({
      id: novoId(), tipo: a.tipo as PermutaAnexo['tipo'], descricao: a.tipo === 'Outro' ? a.descricao : null, nome: a.file.name,
      mime: a.file.type, tamanho: a.file.size, storage_path: '', adicionado_em: new Date().toISOString(),
    }));
    const atual = id ? estado.permutas.find(x => x.id === id) : null;
    const anexos = [...(atual?.anexos || []).filter(a => !removidos.some(r => r.id === a.id)), ...anexosNovos];
    const novo: Permuta = { id: id || novoId(), ...dados, unidades, anexos };
    set({ permutas: id ? estado.permutas.map(x => (x.id === id ? novo : x)) : [...estado.permutas, novo] });
  },
  async excluir(p: Permuta) {
    if (live) { await permutasApi.excluir(p); await recarregarBase(); return; }
    set({ permutas: estado.permutas.filter(x => x.id !== p.id) });
  },
  async criarNegocio(nome: string): Promise<Negocio> {
    const n = live ? await permutasApi.criarNegocio(nome) : { id: novoId(), nome: nome.trim() };
    set({ negocios: porNome([...estado.negocios, n]) });
    return n;
  },
  async renomearNegocio(id: string, nome: string) {
    if (live) await permutasApi.renomearNegocio(id, nome);
    set({ negocios: porNome(estado.negocios.map(n => (n.id === id ? { ...n, nome: nome.trim() } : n))) });
  },
  async link(a: PermutaAnexo): Promise<string | null> {
    if (!live || !a.storage_path) return null;
    return permutasApi.link(a);
  },

  // ---------- Visão Geral ----------
  async salvarFicha(f: Omit<EmpreendimentoFicha, 'id'> & { id?: string }) {
    if (live) {
      const r = await permutasApi.salvarFicha(f);
      set({ fichas: porNome([...estado.fichas.filter(x => x.id !== r.id), r]) });
      return;
    }
    const r = { ...f, id: f.id || novoId() } as EmpreendimentoFicha;
    set({ fichas: porNome([...estado.fichas.filter(x => x.id !== r.id), r]) });
  },
  async excluirFicha(id: string) {
    if (live) await permutasApi.excluirFicha(id);
    set({ fichas: estado.fichas.filter(x => x.id !== id) });
  },
  async salvarDireta(u: Omit<UnidadeDireta, 'id'> & { id?: string }) {
    if (live) { await permutasApi.salvarDireta(u); await recarregarBase(); return; }
    const r = { ...u, id: u.id || novoId() } as UnidadeDireta;
    set({ diretas: u.id ? estado.diretas.map(x => (x.id === u.id ? r : x)) : [...estado.diretas, r] });
  },
  async excluirDireta(id: string) {
    if (live) await permutasApi.excluirDireta(id);
    set({ diretas: estado.diretas.filter(x => x.id !== id) });
  },
};
