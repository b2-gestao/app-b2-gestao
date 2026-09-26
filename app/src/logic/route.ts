/**
 * Screen <-> URL hash, so F5, back/forward and shared links keep the open screen.
 * Hash routing (#/financeiro/saldos) needs no server rewrite. Hashes that do not start
 * with "#/" (Supabase invite / recovery links) are left alone.
 */
const PAGES: Record<string, { path: string; module: string; open: string }> = {
  saldos: { path: 'financeiro/saldos', module: 'Financeiro', open: 'financeiroOpen' },
  lancamentos: { path: 'financeiro/lancamentos', module: 'Financeiro', open: 'financeiroOpen' },
  programacao: { path: 'financeiro/programacao', module: 'Financeiro', open: 'financeiroOpen' },
  fluxo: { path: 'financeiro/fluxo', module: 'Financeiro', open: 'financeiroOpen' },
  usuarios: { path: 'configuracoes/usuarios', module: 'Configurações', open: 'configOpen' },
  departamentos: { path: 'configuracoes/departamentos', module: 'Configurações', open: 'configOpen' },
  perfis: { path: 'configuracoes/perfis', module: 'Configurações', open: 'configOpen' },
  categorias: { path: 'cadastros/financeiro/categorias', module: 'Cadastros', open: 'cadFinOpen' },
  nfCadastros: { path: 'notas-fiscais/cadastros', module: 'Notas Fiscais', open: 'nfOpen' },
};

/** Hash for the screen in this state. */
export function hashFromState(s: any): string {
  if (s.view !== 'app') return '#/';
  if (s.page === 'bi') return '#/bi' + (s.biId ? '/' + encodeURIComponent(s.biId) : '');
  if (PAGES[s.page]) return '#/' + PAGES[s.page].path;
  return '#/modulo/' + encodeURIComponent(s.module || 'Painel');
}

/** State patch for a hash, or null when the hash is not a route. */
export function stateFromHash(hash: string): Record<string, any> | null {
  if (!hash.startsWith('#/')) return null;
  const path = hash.slice(2).replace(/\/+$/, '');
  const home = { view: 'home', page: 'dashboard', iaPanel: null, userMenuOpen: false };
  if (!path) return home;
  const base = { view: 'app', iaPanel: null, userMenuOpen: false };
  const [head, rest] = [path.split('/')[0], path.split('/').slice(1).join('/')];
  if (head === 'bi') return { ...base, page: 'bi', module: 'BI', biOpen: true, biId: rest ? decodeURIComponent(rest) : null, biLoadedKey: null };
  if (head === 'modulo' && rest) return { ...base, page: 'dashboard', module: decodeURIComponent(rest) };
  const page = Object.keys(PAGES).find(k => PAGES[k].path === path);
  if (!page) return home;
  const { module, open } = PAGES[page];
  return { ...base, page, module, [open]: true };
}
