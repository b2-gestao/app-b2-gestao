import type { AppLogic } from '../AppLogic';
import { cadastrosApi } from '../../lib/api';

// Cadastros › Financeiro › Categorias: same behavior as Departamentos (logic/vals/departamentos.ts).
export function categoriasVals(this: AppLogic) {
  const s: any = this.state;
  const all = s.categorias || this.seedCategorias();
  const q = s.cSearch.trim().toLowerCase();
  const statusKey = { 'Todos': null, 'Ativos': true, 'Inativos': false }[s.cStatus];

  const filtered = all.filter(c => {
    if (q && !(c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))) return false;
    if (statusKey !== null && c.active !== statusKey) return false;
    return true;
  });

  const perm = 'cadastros.categorias';
  // Renaming cascades to app_rec_financeiro_lancamento.categoria, so the loaded entries are reloaded too.
  const write = (fn: () => Promise<unknown>, okMsg: string, onError?: (m: string) => void) =>
    this.cadastroAcao(fn, okMsg, async () => { await this.loadCategorias(); await this.loadLanc(); }, onError);
  const semPermissao = 'Seu perfil não tem permissão para alterar categorias.';
  const fechar = { catModalOpen: false, editingCatId: null, cForm: null, catFormErr: '' };

  const actBtn = 'width:27px;height:27px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,color .15s';
  const grid = 'grid-template-columns:minmax(180px,2fr) minmax(220px,3fr) 116px 96px';

  const cRows = filtered.map((c, i) => ({
    name: c.name,
    desc: c.desc || '—',
    rowStyle: `display:grid;${grid};gap:12px;align-items:center;padding:13px 18px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}opacity:0;animation:rowIn .3s ease-out both;animation-delay:${Math.min(i * 25, 300)}ms`,
    statusStyle: `font-size:12px;font-weight:600;color:${c.active ? '#35AD88' : '#64748B'}`,
    statusLabel: c.active ? 'Ativa' : 'Inativa',
    toggleTitle: c.active ? 'Inativar categoria' : 'Reativar categoria',
    trackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${c.active ? '#43B997' : '#D8D8E0'}`,
    knobStyle: `position:absolute;top:2.5px;left:${c.active ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
    toggle: () => {
      const msg = c.active ? `${c.name} foi inativada.` : `${c.name} foi reativada.`;
      if (this.live) {
        if (this.podeEditar(perm)) write(() => cadastrosApi.salvarCategoria(c.id, { nome: c.name, descricao: c.desc || null, ativo: !c.active }), msg);
        return;
      }
      this.setCategorias(list => list.map(x => x.id === c.id ? Object.assign({}, x, { active: !x.active }) : x));
      this.toast(msg);
    },
    actEditStyle: actBtn,
    actPowerStyle: actBtn + (c.active ? '' : ';color:#43B997;border-color:#C7EEE0'),
    edit: () => this.setState({ catModalOpen: true, editingCatId: c.id, cForm: { name: c.name, desc: c.desc, active: c.active }, catFormErr: '' }),
  }));

  const form = s.cForm || { name: '', desc: '', active: true };
  const editing = !!s.editingCatId;
  const errName = s.catFormErr && !form.name.trim();
  const patch = (p: any) => this.setState(st => ({ cForm: Object.assign({}, st.cForm || form, p), catFormErr: '' }));

  return {
    isCategorias: s.page === 'categorias',
    goCategorias: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'categorias', module: 'Cadastros', cadFinOpen: true, userMenuOpen: false }); },
    cCountLabel: `${all.length} categoria${all.length === 1 ? '' : 's'} cadastrada${all.length === 1 ? '' : 's'}`,
    cSearch: s.cSearch,
    onCSearch: e => this.setState({ cSearch: e.target.value }),
    cStatusTabs: ['Todos', 'Ativos', 'Inativos'].map(t => ({
      label: t === 'Todos' ? 'Todas' : t === 'Ativos' ? 'Ativas' : 'Inativas',
      onClick: () => this.setState({ cStatus: t }),
      style: `border:none;border-radius:6px;padding:0 11px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${s.cStatus === t ? '#111827' : 'transparent'};color:${s.cStatus === t ? '#FFFFFF' : '#64748B'}`,
    })),
    clearCatFiltersStyle: `display:${(q || s.cStatus !== 'Todos') ? 'inline-flex' : 'none'};align-items:center;height:36px;padding:0 13px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer`,
    clearCatFilters: () => this.setState({ cSearch: '', cStatus: 'Todos' }),
    cGridStyle: grid,

    cRows,
    cEmptyStyle: `display:${filtered.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:52px 20px`,
    cRangeLabel: filtered.length
      ? `Mostrando ${filtered.length} de ${all.length} categoria${all.length === 1 ? '' : 's'}`
      : 'Nenhum registro para exibir',

    catModalOpen: !!s.catModalOpen,
    closeCatModal: () => this.setState(fechar),
    openNewCat: () => this.setState({ catModalOpen: true, editingCatId: null, cForm: { name: '', desc: '', active: true }, catFormErr: '' }),
    catModalTitle: editing ? 'Editar categoria' : 'Nova categoria',
    catModalSub: editing ? 'Renomear atualiza também os lançamentos que usam esta categoria.' : 'Cadastre uma categoria para os lançamentos manuais.',
    saveCatLabel: editing ? 'Salvar alterações' : 'Cadastrar categoria',
    catEditing: editing,

    cfName: form.name, cfDesc: form.desc,
    cfNameStyle: `height:38px;padding:0 12px;border-radius:8px;border:1px solid ${errName ? '#FCA5A5' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s`,
    onCfName: e => patch({ name: e.target.value }),
    onCfDesc: e => patch({ desc: e.target.value }),
    cfTrackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${form.active ? '#43B997' : '#D8D8E0'}`,
    cfKnobStyle: `position:absolute;top:2.5px;left:${form.active ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
    cfActiveLabel: form.active ? 'Ativa' : 'Inativa',
    cfActiveLabelStyle: `font-size:12.5px;font-weight:600;color:${form.active ? '#35AD88' : '#64748B'}`,
    toggleCfActive: () => patch({ active: !form.active }),

    catFormErr: s.catFormErr,
    catFormErrStyle: `display:${s.catFormErr ? 'flex' : 'none'};align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#FEE9E9;border:1px solid #FCA5A5;color:#DC2626;font-size:12.5px`,
    removeCat: () => {
      const id = s.editingCatId;
      const target = all.find(x => x.id === id);
      const msg = target ? `${target.name} excluída.` : 'Categoria excluída.';
      if (this.live) {
        if (!this.pode(perm, true)) { this.setState({ catFormErr: semPermissao }); return; }
        write(() => cadastrosApi.excluirCategoria(id), msg, m => this.setState({ catFormErr: m }))
          .then(ok => ok && this.setState(fechar));
        return;
      }
      this.setCategorias(list => list.filter(x => x.id !== id));
      this.setState(fechar);
      this.toast(msg);
    },
    saveCat: () => {
      if (!form.name.trim()) {
        this.setState({ catFormErr: 'Informe o nome da categoria para continuar.' });
        return;
      }
      const id = s.editingCatId;
      const dup = all.some(x => x.id !== id && x.name.trim().toLowerCase() === form.name.trim().toLowerCase());
      if (dup) {
        this.setState({ catFormErr: 'Já existe uma categoria com esse nome.' });
        return;
      }
      const rec = { name: form.name.trim(), desc: form.desc.trim(), active: form.active };
      if (this.live) {
        if (!this.pode(perm, true)) { this.setState({ catFormErr: semPermissao }); return; }
        write(() => cadastrosApi.salvarCategoria(id || null, { nome: rec.name, descricao: rec.desc || null, ativo: rec.active }),
          id ? 'Categoria atualizada.' : 'Categoria cadastrada.', m => this.setState({ catFormErr: m }))
          .then(ok => ok && this.setState(fechar));
        return;
      }
      if (id) {
        this.setCategorias(list => list.map(x => x.id === id ? Object.assign({}, x, rec) : x));
        this.toast('Categoria atualizada.');
      } else {
        this.setCategorias(list => [Object.assign({ id: 'c' + Date.now() }, rec)].concat(list));
        this.toast('Categoria cadastrada.');
      }
      this.setState(fechar);
    },
  };
}
