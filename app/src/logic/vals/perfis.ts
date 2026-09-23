import type { AppLogic } from '../AppLogic';

export function perfisVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const all = s.perfis || this.seedPerfis();
  const q = (s.pSearch || '').trim().toLowerCase();
  const statusKey = { 'Todos': null, 'Ativos': true, 'Inativos': false }[s.pStatus || 'Todos'];
  const totalPaths = this.permPaths().length;
  const grantedCount = perms => Object.keys(perms || {}).filter(k => perms[k] && perms[k].view).length;

  const filtered = all.filter(p => {
    if (q && !(p.name.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q))) return false;
    if (statusKey !== null && p.active !== statusKey) return false;
    return true;
  });

  const actBtn = 'width:27px;height:27px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,color .15s';

  const pRows = filtered.map((p, i) => {
    const granted = grantedCount(p.perms);
    return {
      name: p.name, desc: p.desc || '—',
      iconStyle: 'width:32px;height:32px;flex:none;border-radius:9px;background:#F1E9FF;display:flex;align-items:center;justify-content:center',
      countChipStyle: 'min-width:26px;height:22px;padding:0 7px;border-radius:7px;background:#F1E9FF;color:#7C3AED;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;cursor:default',
      countLabel: `${granted}/${totalPaths}`,
      rowStyle: `display:grid;grid-template-columns:minmax(180px,2fr) minmax(220px,3fr) 110px 116px 96px;gap:12px;align-items:center;padding:11px 18px;box-shadow:inset 0 -1px 0 #F4F4F6;opacity:${p.active ? 1 : .62};transition:background .15s,opacity .2s;animation:rowIn .35s ease-out both;animation-delay:${Math.min(i, 14) * 18}ms`,
      trackStyle: `width:32px;height:18px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${p.active ? '#43B997' : '#D8D8E0'}`,
      knobStyle: `position:absolute;top:2.5px;left:${p.active ? '16.5px' : '2.5px'};width:13px;height:13px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
      statusStyle: `font-size:11px;font-weight:600;color:${p.active ? '#35AD88' : '#64748B'};background:${p.active ? '#E1F7EF' : '#F1F1F3'};border-radius:20px;padding:2px 8px;white-space:nowrap`,
      statusLabel: p.active ? 'Ativo' : 'Inativo',
      toggleTitle: p.active ? 'Inativar perfil' : 'Ativar perfil',
      actEditStyle: actBtn, actPowerStyle: actBtn + (p.active ? '' : ';color:#43B997;border-color:#C7EEE0'),
      toggle: () => {
        this.setPerfis(list => list.map(x => x.id === p.id ? Object.assign({}, x, { active: !x.active }) : x));
        this.toast(p.active ? `${p.name} foi inativado.` : `${p.name} foi reativado.`);
      },
      edit: () => this.setState({ perfilModalOpen: true, editingPerfilId: p.id, pFormErr: '', pForm: { name: p.name, desc: p.desc, active: p.active, perms: Object.assign({}, p.perms) } }),
    };
  });

  const form = s.pForm || this.emptyPerfilForm();
  const setPerm = (path, patch) => {
    const perms = Object.assign({}, form.perms);
    perms[path] = Object.assign({ view: false, edit: false }, perms[path], patch);
    this.patchPerfilForm({ perms });
  };
  const permRow = (path, label, indented) => {
    const cur = form.perms[path] || { view: false, edit: false };
    const chk = on => `width:18px;height:18px;border-radius:5px;border:1.5px solid ${on ? '#4161FF' : '#D8D8E0'};background:${on ? '#4161FF' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex:none`;
    return {
      isHeader: false, indented, isLeaf: !indented,
      label,
      labelStyle: indented ? 'font-size:12.5px;color:#374151' : 'font-size:12.5px;font-weight:700;color:#111827',
      viewChecked: cur.view, editChecked: cur.edit,
      viewStyle: chk(cur.view), editStyle: chk(cur.edit),
      viewToggle: () => setPerm(path, { view: !cur.view, edit: !cur.view ? cur.edit : false }),
      editToggle: () => setPerm(path, { edit: !cur.edit, view: !cur.edit ? true : cur.view }),
    };
  };
  const permRows: any[] = [];
  this.permModules.forEach(mod => {
    if (mod.subs.length === 0) {
      permRows.push(permRow(mod.key, mod.label, false));
    } else {
      permRows.push({ isHeader: true, indented: false, isLeaf: false, label: mod.label });
      mod.subs.forEach(sub => permRows.push(permRow(mod.key + '.' + sub.key, sub.label, true)));
    }
  });

  const editing = !!s.editingPerfilId;
  const errName = s.pFormErr && !form.name.trim();

  return {
    isPerfis: s.page === 'perfis',
    goPerfis: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'perfis', module: 'Configurações', configOpen: true, userMenuOpen: false }); },
    perfisItemStyle: s.page === 'perfis'
      ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997'
      : subItemStyle,
    pCountLabel: `${all.length} perfil${all.length === 1 ? '' : 's'} cadastrado${all.length === 1 ? '' : 's'}`,
    pSearch: s.pSearch || '',
    onPSearch: e => this.setState({ pSearch: e.target.value }),
    pStatusTabs: ['Todos', 'Ativos', 'Inativos'].map(t => ({
      label: t,
      onClick: () => this.setState({ pStatus: t }),
      style: `border:none;border-radius:6px;padding:0 11px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${(s.pStatus || 'Todos') === t ? '#FFFFFF' : 'transparent'};color:${(s.pStatus || 'Todos') === t ? '#111827' : '#64748B'};box-shadow:${(s.pStatus || 'Todos') === t ? '0 1px 2px rgba(0,0,0,.08)' : 'none'}`,
    })),
    clearPFiltersStyle: `display:${(q || (s.pStatus && s.pStatus !== 'Todos')) ? 'inline-flex' : 'none'};align-items:center;height:36px;padding:0 13px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#64748B;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer`,
    clearPFilters: () => this.setState({ pSearch: '', pStatus: 'Todos' }),
    pRows,
    pEmptyStyle: `display:${filtered.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:52px 20px`,
    pRangeLabel: filtered.length
      ? `Mostrando ${filtered.length} de ${all.length} perfil${all.length === 1 ? '' : 's'}`
      : 'Nenhum registro para exibir',

    perfilOverlayStyle: `display:${s.perfilModalOpen ? 'flex' : 'none'};position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(2px)`,
    perfilModalCardStyle: 'width:100%;max-width:640px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);animation:modalIn .24s cubic-bezier(.16,1,.3,1) both',
    closePerfilModal: () => this.setState({ perfilModalOpen: false, editingPerfilId: null, pForm: null, pFormErr: '' }),
    openNewPerfil: () => this.setState({ perfilModalOpen: true, editingPerfilId: null, pForm: this.emptyPerfilForm(), pFormErr: '' }),
    perfilModalTitle: editing ? 'Editar perfil' : 'Novo perfil',
    perfilModalSub: editing ? 'Altere o nome, a descrição ou as permissões do perfil.' : 'Defina o nome e as permissões de acesso do novo perfil.',
    savePerfilLabel: editing ? 'Salvar alterações' : 'Cadastrar perfil',

    pfName: form.name, pfDesc: form.desc,
    pfNameStyle: `height:38px;padding:0 12px;border-radius:8px;border:1px solid ${errName ? '#FCA5A5' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s`,
    onPfName: e => this.patchPerfilForm({ name: e.target.value }),
    onPfDesc: e => this.patchPerfilForm({ desc: e.target.value }),
    pfTrackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${form.active ? '#43B997' : '#D8D8E0'}`,
    pfKnobStyle: `position:absolute;top:2.5px;left:${form.active ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
    pfActiveLabel: form.active ? 'Ativo' : 'Inativo',
    pfActiveLabelStyle: `font-size:12.5px;font-weight:600;color:${form.active ? '#258B6C' : '#64748B'}`,
    togglePfActive: () => this.patchPerfilForm({ active: !form.active }),

    permRows,
    permGrantedLabel: `${grantedCount(form.perms)} de ${totalPaths} itens liberados`,

    perfilFormErrStyle: `display:${s.pFormErr ? 'flex' : 'none'};align-items:center;gap:8px;padding:10px 12px;border-radius:8px;background:#FEE9E9;color:#DC2626;font-size:12.5px`,
    perfilFormErr: s.pFormErr,
    deletePerfilBtnStyle: `display:${editing ? 'inline-flex' : 'none'};align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:9px;border:1px solid #EEEEF1;background:#FFFFFF;color:#64748B;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s`,
    removePerfil: () => {
      const id = s.editingPerfilId;
      const target = all.find(x => x.id === id);
      this.setPerfis(list => list.filter(x => x.id !== id));
      this.setState({ perfilModalOpen: false, editingPerfilId: null, pForm: null });
      this.toast(target ? `${target.name} excluído.` : 'Perfil excluído.');
    },
    savePerfil: () => {
      if (!form.name.trim()) { this.setState({ pFormErr: 'Informe o nome do perfil.' }); return; }
      const id = s.editingPerfilId;
      const rec = { name: form.name.trim(), desc: (form.desc || '').trim(), active: form.active, perms: form.perms };
      if (id) {
        this.setPerfis(list => list.map(x => x.id === id ? Object.assign({}, x, rec) : x));
        this.toast('Cadastro atualizado.');
      } else {
        this.setPerfis(list => [Object.assign({ id: 'p' + Date.now() }, rec)].concat(list));
        this.toast('Perfil cadastrado.');
      }
      this.setState({ perfilModalOpen: false, editingPerfilId: null, pForm: null, pFormErr: '' });
    },
  };
}
