import type { AppLogic } from '../AppLogic';

/** Bucket for companies without a row in grupo_empresas_sharepoint. */
export const SEM_GRUPO = 'Sem grupo';

export function grupoDe(app: AppLogic, cd: number | string): string {
  const g = app.empresaById()[Number(cd)]?.grupo;
  return (g && String(g).trim()) || SEM_GRUPO;
}

/** Groups present among `cds`, alphabetical, "Sem grupo" last. */
export function gruposDe(app: AppLogic, cds: (number | string)[]): string[] {
  const set = new Set(cds.map(cd => grupoDe(app, cd)));
  return [...set].sort((a, b) => (a === SEM_GRUPO ? 1 : b === SEM_GRUPO ? -1 : a.localeCompare(b, 'pt-BR')));
}

/** Selection stored in state[`${prefix}GrupoSel`]: undefined = every group. */
export function grupoSel(app: AppLogic, prefix: 'pg' | 'fx'): string[] | undefined {
  const sel = (app.state as any)[prefix + 'GrupoSel'];
  return Array.isArray(sel) ? sel : undefined;
}

export function noGrupo(app: AppLogic, prefix: 'pg' | 'fx', cd: number | string): boolean {
  const sel = grupoSel(app, prefix);
  return !sel || sel.includes(grupoDe(app, cd));
}

/**
 * "Grupo" multi-select for Programação diária / Fluxo de caixa. It narrows the companies shown
 * (and the Empresas dropdown) to the chosen groups; the company selection itself is kept.
 */
export function grupoDropdown(app: AppLogic, prefix: 'pg' | 'fx', cds: (number | string)[]) {
  const s: any = app.state;
  const catalog = gruposDe(app, cds);
  const sel = grupoSel(app, prefix);
  const selected = sel ? catalog.filter(g => sel.includes(g)) : catalog;
  const key = prefix + 'GrupoSel';
  // Everything selected goes back to "undefined" so groups added later are not hidden.
  const store = (list: string[]) => app.setState({ [key]: list.length === catalog.length && catalog.every(g => list.includes(g)) ? undefined : list });
  return app.mkMultiDropdown(prefix + 'Grupo', s, selected, catalog.map(name => ({ name })),
    (name: string) => store(selected.includes(name) ? selected.filter(g => g !== name) : selected.concat(name)),
    store,
    { all: 'Todos os grupos', none: 'Nenhum grupo', fem: false });
}
