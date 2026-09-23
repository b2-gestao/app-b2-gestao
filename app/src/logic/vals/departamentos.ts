import type { AppLogic } from '../AppLogic';

export function deptsVals(this: AppLogic) {
  const s: any = this.state;
  const all = s.depts || this.seedDepts();
  const users = s.users || this.seedUsers();
  const q = s.dSearch.trim().toLowerCase();
  const statusKey = { 'Todos': null, 'Ativos': true, 'Inativos': false }[s.dStatus];

  const filtered = all.filter(d => {
    if (q && !(d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q))) return false;
    if (statusKey !== null && d.active !== statusKey) return false;
    return true;
  });

  const actBtn = 'width:27px;height:27px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,color .15s';

  const dRows = filtered.map((d, i) => {
    const userCount = users.filter(u => u.dept === d.name && u.status !== 'inativo').length;
    return {
      name: d.name,
      desc: d.desc || '—',
      userCount,
      rowStyle: `display:grid;grid-template-columns:minmax(180px,2fr) minmax(220px,3fr) 120px 116px 96px;gap:12px;align-items:center;padding:13px 18px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}opacity:0;animation:rowIn .3s ease-out both;animation-delay:${Math.min(i * 25, 300)}ms`,
      iconStyle: 'width:34px;height:34px;flex:none;border-radius:9px;background:#E1F7EF;display:flex;align-items:center;justify-content:center',
      countChipStyle: `display:inline-flex;min-width:24px;height:22px;padding:0 7px;border-radius:20px;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;background:${userCount ? '#EAF1FF' : '#F1F1F3'};color:${userCount ? '#4161FF' : '#94A3B8'}`,
      statusStyle: `font-size:12px;font-weight:600;color:${d.active ? '#35AD88' : '#64748B'}`,
      statusLabel: d.active ? 'Ativo' : 'Inativo',
      toggleTitle: d.active ? 'Inativar departamento' : 'Reativar departamento',
      trackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${d.active ? '#43B997' : '#D8D8E0'}`,
      knobStyle: `position:absolute;top:2.5px;left:${d.active ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
      toggle: () => {
        this.setDepts(list => list.map(x => x.id === d.id ? Object.assign({}, x, { active: !x.active }) : x));
        this.toast(d.active ? `${d.name} foi inativado.` : `${d.name} foi reativado.`);
      },
      actEditStyle: actBtn,
      actPowerStyle: actBtn + (d.active ? '' : ';color:#43B997;border-color:#C7EEE0'),
      edit: () => this.setState({ deptModalOpen: true, editingDeptId: d.id, dForm: { name: d.name, desc: d.desc, active: d.active }, deptFormErr: '' }),
    };
  });

  const form = s.dForm || this.emptyDeptForm();
  const editing = !!s.editingDeptId;
  const errName = s.deptFormErr && !form.name.trim();

  return {
    dCountLabel: `${all.length} departamento${all.length === 1 ? '' : 's'} cadastrado${all.length === 1 ? '' : 's'}`,
    dSearch: s.dSearch,
    onDSearch: e => this.setState({ dSearch: e.target.value }),
    dStatusTabs: ['Todos', 'Ativos', 'Inativos'].map(t => ({
      label: t,
      onClick: () => this.setState({ dStatus: t }),
      style: `border:none;border-radius:6px;padding:0 11px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${s.dStatus === t ? '#111827' : 'transparent'};color:${s.dStatus === t ? '#FFFFFF' : '#64748B'}`,
    })),
    clearDeptFiltersStyle: `display:${(q || s.dStatus !== 'Todos') ? 'inline-flex' : 'none'};align-items:center;height:36px;padding:0 13px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer`,
    clearDeptFilters: () => this.setState({ dSearch: '', dStatus: 'Todos' }),

    dRows,
    dEmptyStyle: `display:${filtered.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:52px 20px`,
    dRangeLabel: filtered.length
      ? `Mostrando ${filtered.length} de ${all.length} departamento${all.length === 1 ? '' : 's'}`
      : 'Nenhum registro para exibir',

    deptOverlayStyle: `display:${s.deptModalOpen ? 'flex' : 'none'};position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both`,
    deptModalCardStyle: 'width:100%;max-width:560px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both',
    closeDeptModal: () => this.setState({ deptModalOpen: false, editingDeptId: null, dForm: null, deptFormErr: '' }),
    openNewDept: () => this.setState({ deptModalOpen: true, editingDeptId: null, dForm: this.emptyDeptForm(), deptFormErr: '' }),
    deptModalTitle: editing ? 'Editar departamento' : 'Novo departamento',
    deptModalSub: editing ? 'Altere os dados e salve para atualizar o cadastro.' : 'Cadastre um novo departamento para vincular aos usuários.',
    saveDeptLabel: editing ? 'Salvar alterações' : 'Cadastrar departamento',

    dfName: form.name, dfDesc: form.desc,
    dfNameStyle: `height:38px;padding:0 12px;border-radius:8px;border:1px solid ${errName ? '#FCA5A5' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s`,
    onDfName: e => this.patchDeptForm({ name: e.target.value }),
    onDfDesc: e => this.patchDeptForm({ desc: e.target.value }),
    dfTrackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${form.active ? '#43B997' : '#D8D8E0'}`,
    dfKnobStyle: `position:absolute;top:2.5px;left:${form.active ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
    dfActiveLabel: form.active ? 'Ativo' : 'Inativo',
    dfActiveLabelStyle: `font-size:12.5px;font-weight:600;color:${form.active ? '#35AD88' : '#64748B'}`,
    toggleDfActive: () => this.patchDeptForm({ active: !form.active }),

    deptFormErr: s.deptFormErr,
    deptFormErrStyle: `display:${s.deptFormErr ? 'flex' : 'none'};align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#FEE9E9;border:1px solid #FCA5A5;color:#DC2626;font-size:12.5px`,
    deleteDeptBtnStyle: `display:${editing ? 'inline-flex' : 'none'};align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:9px;border:1px solid #E7E7EA;background:#FFFFFF;color:#DC2626;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s`,
    removeDept: () => {
      const id = s.editingDeptId;
      const target = all.find(x => x.id === id);
      this.setDepts(list => list.filter(x => x.id !== id));
      this.setState({ deptModalOpen: false, editingDeptId: null, dForm: null });
      this.toast(target ? `${target.name} excluído.` : 'Departamento excluído.');
    },
    saveDept: () => {
      if (!form.name.trim()) {
        this.setState({ deptFormErr: 'Informe o nome do departamento para continuar.' });
        return;
      }
      const id = s.editingDeptId;
      const dup = all.some(x => x.id !== id && x.name.trim().toLowerCase() === form.name.trim().toLowerCase());
      if (dup) {
        this.setState({ deptFormErr: 'Já existe um departamento com esse nome.' });
        return;
      }
      const rec = { name: form.name.trim(), desc: form.desc.trim(), active: form.active };
      if (id) {
        this.setDepts(list => list.map(x => x.id === id ? Object.assign({}, x, rec) : x));
        this.toast('Cadastro atualizado.');
      } else {
        this.setDepts(list => [Object.assign({ id: 'd' + Date.now() }, rec)].concat(list));
        this.toast('Departamento cadastrado.');
      }
      this.setState({ deptModalOpen: false, editingDeptId: null, dForm: null, deptFormErr: '' });
    },
  };
}
