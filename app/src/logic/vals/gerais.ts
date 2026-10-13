import type { AppLogic } from '../AppLogic';
import { api, cadastrosApi, empresaLabel } from '../../lib/api';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PERM = 'configuracoes.gerais';

type Item = { cd: number; motivo: string };

/**
 * Loads Configurações › Gerais: the saved list (state.gerLista) and the catalog of companies the
 * user can access, desconsideradas included (state.gerCatalogo; app_empresas leaves them out).
 */
export async function loadGerais(this: AppLogic) {
  if (!this.live) { this.setState({ gerLista: this.state.gerLista || [], gerCatalogo: null }); return; }
  this.setState({ gerLoading: true });
  try {
    const [rows, empresas] = await Promise.all([cadastrosApi.empresasDesconsideradas(), api.empresasGerais()]);
    this.setState({
      gerLista: rows.map(r => ({ cd: r.company_id, motivo: r.motivo })),
      gerCatalogo: empresas.map(e => ({ cd: Number(e.id), name: empresaLabel(e) || `Empresa ${e.id}` })),
      gerDraft: null, gerLoading: false,
    });
  } catch (e: any) {
    this.setState({ gerLista: [], gerLoading: false });
    this.toast('Não foi possível carregar as configurações gerais: ' + e.message);
  }
}

/**
 * Configurações › Gerais: empresas desconsideradas em todo o app (app_empresas_desconsideradas).
 * Edits a draft; "Salvar" writes the changes and reloads every company-based data set.
 */
export function geraisVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const podeEditar = this.pode(PERM, true);
  const catalog: { cd: number; name: string }[] = s.gerCatalogo
    || (this.live
      ? Object.values(this.empresaById()).map((e: any) => ({ cd: Number(e.id), name: e.label }))
      : this.fxSeed().map(e => ({ cd: e.cd, name: e.name })));
  const nameOf = (cd: number) => catalog.find(e => e.cd === cd)?.name || `Empresa ${cd}`;

  const saved: Item[] = s.gerLista || [];
  const draft: Item[] = s.gerDraft || saved;
  const setDraft = (list: Item[]) => this.setState({ gerDraft: list, gerErr: '' });
  const inDraft = new Set(draft.map(d => d.cd));
  const savedByCd = new Map(saved.map(x => [x.cd, x.motivo]));
  const dirty = draft.length !== saved.length || draft.some(d => savedByCd.get(d.cd) !== d.motivo);

  const q = norm((s.gerQuery || '').trim());
  const qCode = q.replace(/\D/g, '');
  const results = s.gerPick != null || !q ? [] : catalog
    .filter(e => !inDraft.has(e.cd) && ((qCode && String(e.cd).includes(qCode)) || norm(e.name).includes(q)))
    .sort((a, b) => (String(b.cd) === qCode ? 1 : 0) - (String(a.cd) === qCode ? 1 : 0) || a.cd - b.cd)
    .slice(0, 8);

  const reset = { gerQuery: '', gerPick: null, gerMotivo: '', gerErr: '' };

  const add = () => {
    if (!podeEditar) { this.setState({ gerErr: 'Seu perfil não tem permissão para alterar as configurações gerais.' }); return; }
    if (s.gerPick == null) { this.setState({ gerErr: 'Selecione uma empresa pela pesquisa (código ou nome).' }); return; }
    if (!(s.gerMotivo || '').trim()) { this.setState({ gerErr: 'Informe o motivo de desconsiderar a empresa.' }); return; }
    this.setState({ gerDraft: [{ cd: s.gerPick, motivo: s.gerMotivo.trim() }].concat(draft), ...reset });
  };

  const save = () => {
    if (s.gerSaving || !dirty) return;
    if (!podeEditar) { this.setState({ gerErr: 'Seu perfil não tem permissão para alterar as configurações gerais.' }); return; }
    const semMotivo = draft.find(d => !d.motivo.trim());
    if (semMotivo) { this.setState({ gerErr: `Informe o motivo da empresa ${semMotivo.cd}.` }); return; }
    const rows = draft.map(d => ({ cd: d.cd, motivo: d.motivo.trim() }));
    const okMsg = rows.length
      ? `Configuração salva · ${rows.length} empresa${rows.length > 1 ? 's' : ''} desconsiderada${rows.length > 1 ? 's' : ''} no sistema.`
      : 'Configuração salva · todas as empresas voltam a ser consideradas.';
    if (!this.live) { this.setState({ gerLista: rows, gerDraft: null, ...reset }); this.toast(okMsg); return; }
    const alterados = rows.filter(r => savedByCd.get(r.cd) !== r.motivo).map(r => ({ company_id: r.cd, motivo: r.motivo }));
    const remover = saved.map(x => x.cd).filter(cd => !rows.some(r => r.cd === cd));
    this.setState({ gerSaving: true });
    this.cadastroAcao(
      () => cadastrosApi.salvarEmpresasDesconsideradas(alterados, remover),
      okMsg,
      async () => { await this.loadGerais(); await this.recarregarDados(); },
      m => this.setState({ gerErr: m, gerSaving: false }),
    ).then(ok => ok && this.setState({ gerSaving: false, ...reset }));
  };

  const inputStyle = (err: boolean) => `height:38px;width:100%;box-sizing:border-box;padding:0 12px;border-radius:8px;border:1px solid ${err ? '#FCA5A5' : '#E7E7EA'};background:${podeEditar ? '#FFFFFF' : '#F8F8FA'};font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s`;
  const errPick = !!s.gerErr && s.gerPick == null && s.gerErr.startsWith('Selecione');
  const errMotivo = !!s.gerErr && s.gerErr.startsWith('Informe o motivo de');
  const grid = 'grid-template-columns:84px minmax(200px,2fr) minmax(220px,3fr) 52px';

  return {
    isGerais: s.page === 'gerais',
    goGerais: (e) => { if (e && e.preventDefault) e.preventDefault(); if (this.semAcesso(this.pode(PERM))) return; this.setState({ view: 'app', page: 'gerais', module: 'Configurações', configOpen: true, userMenuOpen: false }); },
    geraisItemStyle: s.page === 'gerais'
      ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997'
      : subItemStyle,

    gerLoading: !!s.gerLoading && !s.gerLista,
    gerPodeEditar: podeEditar,
    gerCountLabel: saved.length
      ? `${saved.length} empresa${saved.length > 1 ? 's' : ''} desconsiderada${saved.length > 1 ? 's' : ''}`
      : 'Nenhuma empresa desconsiderada',
    gerQuery: s.gerQuery || '',
    onGerQuery: e => this.setState({ gerQuery: e.target.value, gerPick: null, gerErr: '' }),
    gerQueryStyle: inputStyle(errPick) + ';padding-left:33px',
    gerResults: results.map(e => ({
      cd: e.cd, name: e.name,
      onClick: () => this.setState({ gerPick: e.cd, gerQuery: `${e.cd} · ${e.name}`, gerErr: '' }),
    })),
    gerNoResults: !!q && s.gerPick == null && results.length === 0,
    gerMotivo: s.gerMotivo || '',
    onGerMotivo: e => this.setState({ gerMotivo: e.target.value, gerErr: '' }),
    onGerMotivoKey: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
    gerMotivoStyle: inputStyle(errMotivo),
    addGer: add,
    gerGridStyle: grid,
    gerRows: draft.map((d, i) => ({
      cd: d.cd,
      name: nameOf(d.cd),
      motivo: d.motivo,
      novo: !savedByCd.has(d.cd),
      rowStyle: `display:grid;${grid};gap:12px;align-items:center;padding:11px 18px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}opacity:0;animation:rowIn .3s ease-out both;animation-delay:${Math.min(i * 25, 300)}ms`,
      motivoStyle: inputStyle(!!s.gerErr && !d.motivo.trim()) + ';height:34px',
      onMotivo: e => setDraft(draft.map(x => (x.cd === d.cd ? { ...x, motivo: e.target.value } : x))),
      remove: () => setDraft(draft.filter(x => x.cd !== d.cd)),
    })),
    gerEmpty: draft.length === 0,
    gerErr: s.gerErr || '',
    gerDirty: dirty,
    gerFooterLabel: dirty ? 'Alterações não salvas' : (saved.length ? 'Tudo salvo' : 'Nenhuma empresa na lista'),
    discardGer: () => this.setState({ gerDraft: null, ...reset }),
    saveGer: save,
    gerSaveLabel: s.gerSaving ? 'Salvando…' : 'Salvar alterações',
    gerSaving: !!s.gerSaving,
  };
}
