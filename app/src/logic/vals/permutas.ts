import type { AppLogic } from '../AppLogic';
import type { PaginaPermutas, PermutasCtx } from '../../screens/permutas/comum';

/** Página do app → tela de Permutas › Terrenos e a permissão do menu (Insights usa a da Visão Geral). */
const PAGINAS: Record<string, { pagina: PaginaPermutas; perm: string }> = {
  permutasCadastro: { pagina: 'cadastros', perm: 'permutas.cadastro' },
  permutasVisao: { pagina: 'visao', perm: 'permutas.visao' },
  permutasInsights: { pagina: 'insights', perm: 'permutas.visao' },
};
const PAGE_DE: Record<PaginaPermutas, string> = { cadastros: 'permutasCadastro', visao: 'permutasVisao', insights: 'permutasInsights' };
export const TITULO_PERMUTAS: Record<string, string> = { permutasCadastro: 'Cadastros', permutasVisao: 'Visão Geral', permutasInsights: 'Insights' };

/** Permutas › Terrenos (Cadastros, Visão Geral, Insights): menu, navegação e o contexto das telas (screens/permutas). */
export function permutasVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const activeItem = ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997';
  const atual = s.view === 'app' ? PAGINAS[s.page] : undefined;
  const ir = (pagina: PaginaPermutas, e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    const page = PAGE_DE[pagina];
    if (this.semAcesso(this.pode(PAGINAS[page].perm))) return;
    this.setState({ view: 'app', page, module: 'Permutas', permutasOpen: true, permutasTerrenosOpen: true, userMenuOpen: false });
  };
  const ctx: PermutasCtx = {
    pagina: atual ? atual.pagina : null,
    live: this.live,
    toast: (m: string) => this.toast(m),
    podeEditar: () => !!atual && this.pode(atual.perm, true),
    empresas: () => (s.dbEmpresas || []).map((e: any) => ({
      id: e.id, nome: (e.nome_fantasia || e.nome || '').trim(), emp: e.empreendimentos || null,
    })),
    ir: (p: PaginaPermutas) => ir(p),
  };
  const item = (page: string) => subItemStyle + ';padding-left:22px' + (s.page === page || (page === 'permutasVisao' && s.page === 'permutasInsights') ? activeItem : '');
  // Terrenos é um submenu dentro de Permutas: abre ao clicar e já vem aberto quando uma das telas está ativa.
  const terrenosAberto = !!s.permutasTerrenosOpen || (!!atual && s.permutasTerrenosOpen !== false);
  return {
    permutasTerrenosStyle: subItemStyle + ';display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none' + (atual && !terrenosAberto ? ';color:#F5F5F7;font-weight:600' : ''),
    permutasTerrenosChevron: terrenosAberto ? 'rotate(180deg)' : 'rotate(0deg)',
    permutasTerrenosContentStyle: `display:grid;grid-template-rows:${terrenosAberto ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    togglePermutasTerrenos: (e?: any) => {
      if (e && e.preventDefault) e.preventDefault();
      this.setState({ permutasTerrenosOpen: !terrenosAberto });
    },
    permutasCadastroItemStyle: item('permutasCadastro'),
    permutasVisaoItemStyle: item('permutasVisao'),
    goPermutasCadastro: (e?: any) => ir('cadastros', e),
    goPermutasVisao: (e?: any) => ir('visao', e),
    isPermutas: !!atual,
    permutas: ctx,
  };
}
