import type { AppLogic } from '../AppLogic';

export function usersVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const all = s.users || this.seedUsers();
  const q = s.uSearch.trim().toLowerCase();
  const statusKey = { 'Todos': null, 'Ativos': 'ativo', 'Inativos': 'inativo', 'Pendentes': 'pendente' }[s.uStatus];

  const filtered = all.filter(u => {
    if (q && !(u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) && q.replace(/\D/g, ''))) return false;
    if (s.uRole !== 'Todas as funções' && u.role !== s.uRole) return false;
    if (s.uDept !== 'Todos os departamentos' && u.dept !== s.uDept) return false;
    if (s.uEmpF !== 'Todas as empresas' && u.empresas.indexOf(s.uEmpF) < 0) return false;
    if (statusKey && u.status !== statusKey) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / this.uPerPage));
  const page = Math.min(s.uPage, totalPages);
  const start = (page - 1) * this.uPerPage;
  const slice = filtered.slice(start, start + this.uPerPage);

  const palette = ['#4161FF', '#43B997', '#7C3AED', '#F59E0B', '#EC4899', '#0EA5E9'];
  const statusMeta = {
    ativo: { label: 'Ativo', color: '#35AD88', bg: '#E1F7EF' },
    inativo: { label: 'Inativo', color: '#64748B', bg: '#F1F1F3' },
    pendente: { label: 'Pendente', color: '#D97706', bg: '#FFF0DD' },
  };
  const actBtn = 'width:27px;height:27px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,color .15s';

  const uRows = slice.map((u, i) => {
    const parts = u.name.split(' ');
    const color = palette[(u.id.charCodeAt(1) + u.name.length) % palette.length];
    const meta = statusMeta[u.status];
    const on = u.status === 'ativo';
    return {
      name: u.name, email: u.email, phone: u.phone, role: u.role, dept: u.dept,
      initials: (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase(),
      empCount: u.empresas.length, ccCount: u.centros.length,
      empList: u.empresas.join('\n'), ccList: u.centros.join('\n'),
      statusLabel: meta.label,
      toggleTitle: on ? 'Inativar usuário' : 'Ativar usuário',
      rowStyle: `display:grid;grid-template-columns:minmax(210px,2.2fr) 132px 158px 138px 78px 78px 116px 128px;gap:12px;align-items:center;padding:11px 18px;box-shadow:inset 0 -1px 0 #F4F4F6;opacity:${u.status === 'inativo' ? .62 : 1};transition:background .15s,opacity .2s;animation:rowIn .35s ease-out both;animation-delay:${Math.min(i, 14) * 18}ms`,
      avatarStyle: `width:32px;height:32px;flex:none;border-radius:9px;background:${color}18;color:${color};display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700`,
      countChipStyle: 'min-width:26px;height:22px;padding:0 7px;border-radius:7px;background:#EAF1FF;color:#2445E8;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;cursor:default',
      ccChipStyle: 'min-width:26px;height:22px;padding:0 7px;border-radius:7px;background:#F1E9FF;color:#7C3AED;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;cursor:default',
      trackStyle: `width:32px;height:18px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${on ? '#43B997' : '#D8D8E0'}`,
      knobStyle: `position:absolute;top:2.5px;left:${on ? '16.5px' : '2.5px'};width:13px;height:13px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
      statusStyle: `font-size:11px;font-weight:600;color:${meta.color};background:${meta.bg};border-radius:20px;padding:2px 8px;white-space:nowrap`,
      actEditStyle: actBtn, actMailStyle: actBtn, actResetStyle: actBtn,
      actPowerStyle: actBtn + (on ? '' : ';color:#43B997;border-color:#C7EEE0'),
      toggle: () => {
        if (this.live) { this.usuarioAcao('definir_status', { id: u.id, ativo: !on }, on ? `${parts[0]} foi inativado.` : `${parts[0]} foi reativado.`); return; }
        this.setUsers(list => list.map(x => x.id === u.id ? Object.assign({}, x, { status: on ? 'inativo' : 'ativo' }) : x));
        this.toast(on ? `${parts[0]} foi inativado.` : `${parts[0]} foi reativado.`);
      },
      edit: () => this.setState({
        modalOpen: true, editingId: u.id, formErr: '',
        uForm: { name: u.name, email: u.email, phone: u.phone, role: u.role, dept: u.dept, empresas: u.empresas.slice(), centros: u.centros.slice(), active: u.status !== 'inativo' },
      }),
      sendDefine: () => {
        if (this.live) { this.usuarioAcao('reenviar_convite', { id: u.id }, `Link de definição de senha enviado para ${u.email}.`); return; }
        this.setUsers(list => list.map(x => x.id === u.id && x.status !== 'inativo' ? Object.assign({}, x, { status: 'pendente' }) : x));
        this.toast(`Link de definição de senha enviado para ${u.email}.`);
      },
      sendReset: () => (this.live ? this.usuarioAcao('redefinir_senha', { id: u.id }, `Redefinição de senha enviada para ${u.email}.`) : this.toast(`Redefinição de senha enviada para ${u.email}.`)),
    };
  });

  const mkPageBtn = (n, active) => `min-width:30px;height:30px;padding:0 8px;border-radius:8px;border:1px solid ${active ? '#4161FF' : '#EEEEF1'};background:${active ? '#4161FF' : '#FFFFFF'};color:${active ? '#FFFFFF' : '#64748B'};font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s`;
  let from = Math.max(1, page - 2);
  const to = Math.min(totalPages, from + 4);
  from = Math.max(1, to - 4);
  const uPages: any[] = [];
  for (let n = from; n <= to; n++) uPages.push({ n, style: mkPageBtn(n, n === page), go: () => this.setState({ uPage: n }) });
  const navBtn = dis => `width:30px;height:30px;border-radius:8px;border:1px solid #EEEEF1;background:#FFFFFF;color:${dis ? '#CBD5E1' : '#64748B'};display:flex;align-items:center;justify-content:center;cursor:${dis ? 'default' : 'pointer'};transition:all .15s`;

  const form = s.uForm || this.emptyForm();
  const empresas = this.userEmpresas();
  const centros = this.userCentros();
  const empNames = empresas.map(e => e.n);
  const chipOn = (on, color) => `display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:20px;font-size:12px;font-weight:${on ? 600 : 500};cursor:pointer;white-space:nowrap;flex:none;border:1px solid ${on ? color : '#E7E7EA'};background:${on ? color + '12' : '#FFFFFF'};color:${on ? color : '#64748B'};transition:all .15s;user-select:none`;
  const empColorByName: any = {}; empresas.forEach(e => { empColorByName[e.n] = e.c; });
  const empChips = form.empresas.map(n => ({
    name: n,
    style: chipOn(true, empColorByName[n] || '#4161FF'),
    dotStyle: `width:8px;height:8px;border-radius:3px;background:${empColorByName[n] || '#4161FF'}`,
    toggle: () => this.patchForm({ empresas: form.empresas.filter(x => x !== n) }),
  }));
  const ccChips = form.centros.map(c => ({
    name: c,
    style: chipOn(true, '#7C3AED'),
    toggle: () => this.patchForm({ centros: form.centros.filter(x => x !== c) }),
  }));
  const empCatalog = empresas.map(e => ({ id: e.id, name: e.n }));
  const ccCatalog = centros.map(c => { const [id, ...rest] = c.split(' · '); return { id, name: rest.join(' · ') }; });
  const pickEmp = this.mkPicker('emp', s, form.empresas, empCatalog,
    name => this.patchForm({ empresas: form.empresas.indexOf(name) >= 0 ? form.empresas.filter(x => x !== name) : form.empresas.concat([name]) }));
  const pickCc = this.mkPicker('cc', s, form.centros, ccCatalog,
    name => this.patchForm({ centros: form.centros.indexOf(name) >= 0 ? form.centros.filter(x => x !== name) : form.centros.concat([name]) }));

  const editing = !!s.editingId;
  const fieldBase = 'height:38px;padding:0 12px;border-radius:8px;background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s;border:1px solid ';
  const errName = s.formErr && !form.name.trim();
  const errEmail = s.formErr && !/.+@.+\..+/.test(form.email.trim());

  const ddRole = this.mkDropdown('role', s, s.uRole, ['Todas as funções'].concat(this.uRoles), v => this.setState({ uRole: v, uPage: 1 }));
  const ddDept = this.mkDropdown('dept', s, s.uDept, ['Todos os departamentos'].concat(this.uDepts), v => this.setState({ uDept: v, uPage: 1 }));
  const ddEmp = this.mkDropdown('emp', s, s.uEmpF, ['Todas as empresas'].concat(empNames), v => this.setState({ uEmpF: v, uPage: 1 }));
  const ddFRole = this.mkDropdown('frole', s, form.role, this.uRoles, v => this.patchForm({ role: v }));
  const ddFDept = this.mkDropdown('fdept', s, form.dept, this.uDepts, v => this.patchForm({ dept: v }));

  return {
    ddRole, ddDept, ddEmp, ddFRole, ddFDept,
    ddOverlayStyle: `display:${s.ddOpen ? 'block' : 'none'};position:fixed;inset:0;z-index:75;background:transparent`,
    closeDropdowns: () => this.setState({ ddOpen: null }),
    isUsuarios: s.page === 'usuarios',
    isDashboard: !['usuarios', 'departamentos', 'perfis', 'saldos', 'lancamentos', 'programacao', 'fluxo'].includes(s.page),
    goUsuarios: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'usuarios', module: 'Configurações', configOpen: true, userMenuOpen: false }); },
    usuariosItemStyle: s.page === 'usuarios'
      ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997'
      : subItemStyle,
    isDepartamentos: s.page === 'departamentos',
    goDepartamentos: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'departamentos', module: 'Configurações', configOpen: true, userMenuOpen: false }); },
    departamentosItemStyle: s.page === 'departamentos'
      ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997'
      : subItemStyle,

    uCountLabel: `${filtered.length} de ${all.length} usuários · ${all.filter(u => u.status === 'ativo').length} ativos · ${all.filter(u => u.status === 'pendente').length} com convite pendente`,
    roleOpts: ['Todas as funções'].concat(this.uRoles),
    deptOpts: ['Todos os departamentos'].concat(this.uDepts),
    empOpts: ['Todas as empresas'].concat(empNames),
    uSearch: s.uSearch, uRole: s.uRole, uDept: s.uDept, uEmpF: s.uEmpF,
    onSearch: e => this.setState({ uSearch: e.target.value, uPage: 1 }),
    onRole: e => this.setState({ uRole: e.target.value, uPage: 1 }),
    onDept: e => this.setState({ uDept: e.target.value, uPage: 1 }),
    onEmpF: e => this.setState({ uEmpF: e.target.value, uPage: 1 }),
    statusTabs: ['Todos', 'Ativos', 'Inativos', 'Pendentes'].map(t => ({
      label: t,
      onClick: () => this.setState({ uStatus: t, uPage: 1 }),
      style: `border:none;border-radius:6px;padding:0 11px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${s.uStatus === t ? '#111827' : 'transparent'};color:${s.uStatus === t ? '#FFFFFF' : '#64748B'}`,
    })),
    clearFiltersStyle: `display:${(q || s.uRole !== 'Todas as funções' || s.uDept !== 'Todos os departamentos' || s.uEmpF !== 'Todas as empresas' || s.uStatus !== 'Todos') ? 'inline-flex' : 'none'};align-items:center;height:36px;padding:0 13px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer`,
    clearFilters: () => this.setState({ uSearch: '', uRole: 'Todas as funções', uDept: 'Todos os departamentos', uEmpF: 'Todas as empresas', uStatus: 'Todos', uPage: 1 }),

    uRows,
    uEmptyStyle: `display:${filtered.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:52px 20px`,
    uRangeLabel: filtered.length
      ? `Mostrando ${start + 1}–${Math.min(start + this.uPerPage, filtered.length)} de ${filtered.length} registros · 25 por página`
      : 'Nenhum registro para exibir',
    uPages,
    uPrevStyle: navBtn(page <= 1),
    uNextStyle: navBtn(page >= totalPages),
    uPrev: () => this.setState({ uPage: Math.max(1, page - 1) }),
    uNext: () => this.setState({ uPage: Math.min(totalPages, page + 1) }),

    overlayStyle: `display:${s.modalOpen ? 'flex' : 'none'};position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both`,
    modalCardStyle: 'width:100%;max-width:900px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both',
    stopProp: e => e.stopPropagation(),
    closeModal: () => this.setState({ modalOpen: false, editingId: null, uForm: null, formErr: '' }),
    openNew: () => this.setState({ modalOpen: true, editingId: null, uForm: this.emptyForm(), formErr: '' }),
    modalTitle: editing ? 'Editar usuário' : 'Novo usuário',
    modalSub: editing ? 'Altere os dados e salve para atualizar o acesso.' : 'O usuário recebe um link de definição de senha ao ser salvo.',
    saveLabel: editing ? 'Salvar alterações' : 'Cadastrar usuário',

    fName: form.name, fEmail: form.email, fPhone: form.phone, fRole: form.role, fDept: form.dept,
    fNameStyle: fieldBase + (errName ? '#FCA5A5' : '#E7E7EA'),
    fEmailStyle: fieldBase + (errEmail ? '#FCA5A5' : '#E7E7EA'),
    onFName: e => this.patchForm({ name: e.target.value }),
    onFEmail: e => this.patchForm({ email: e.target.value }),
    onFPhone: e => this.patchForm({ phone: e.target.value }),
    onFRole: e => this.patchForm({ role: e.target.value }),
    onFDept: e => this.patchForm({ dept: e.target.value }),
    roleList: this.uRoles, deptList: this.uDepts,
    fTrackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${form.active ? '#43B997' : '#D8D8E0'}`,
    fKnobStyle: `position:absolute;top:2.5px;left:${form.active ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
    fActiveLabel: form.active ? 'Ativo' : 'Inativo',
    fActiveLabelStyle: `font-size:12.5px;font-weight:600;color:${form.active ? '#35AD88' : '#64748B'}`,
    toggleFActive: () => this.patchForm({ active: !form.active }),

    empChips, ccChips, pickEmp, pickCc,
    pickerOverlayStyle: `display:${s.pickerOpen ? 'block' : 'none'};position:fixed;inset:0;z-index:78;background:transparent`,
    closePicker: () => this.setState({ pickerOpen: null, pickerQuery: '' }),
    fEmpCountLabel: `${form.empresas.length} de ${empNames.length} selecionadas`,
    fCcCountLabel: `${form.centros.length} de ${centros.length} selecionados`,

    formErr: s.formErr,
    formErrStyle: `display:${s.formErr ? 'flex' : 'none'};align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#FEE9E9;border:1px solid #FCA5A5;color:#DC2626;font-size:12.5px`,
    deleteBtnStyle: `display:${editing ? 'inline-flex' : 'none'};align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:9px;border:1px solid #E7E7EA;background:#FFFFFF;color:#DC2626;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s`,
    removeUser: () => {
      const id = s.editingId;
      if (this.live) { this.usuarioAcao('excluir', { id }, 'Usuário excluído.').then(ok => ok && this.setState({ modalOpen: false, editingId: null, uForm: null })); return; }
      this.setUsers(list => list.filter(x => x.id !== id));
      this.setState({ modalOpen: false, editingId: null, uForm: null });
      this.toast('Usuário excluído.');
    },
    saveUser: () => {
      if (!form.name.trim() || !/.+@.+\..+/.test(form.email.trim())) {
        this.setState({ formErr: 'Informe o nome completo e um e-mail válido para continuar.' });
        return;
      }
      const id = s.editingId;
      if (this.live) {
        if (s.uSaving) return;
        const payload = {
          nome: form.name.trim(), email: form.email.trim(), telefone: form.phone.trim(), funcao: form.role, departamento: form.dept,
          empresas: this.empresaIdsFromLabels(form.empresas), centros_custo: form.centros.map(c => parseInt(c, 10)).filter(n => n > 0), ativo: form.active,
        };
        this.setState({ uSaving: true });
        this.usuarioAcao(id ? 'atualizar' : 'convidar', id ? { id, ...payload } : payload, id ? 'Cadastro atualizado.' : 'Usuário cadastrado · link de definição de senha enviado.', err => this.setState({ formErr: err }))
          .then(ok => { this.setState({ uSaving: false }); if (ok) this.setState({ modalOpen: false, editingId: null, uForm: null, formErr: '', uPage: id ? s.uPage : 1 }); });
        return;
      }
      const rec = {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || '—',
        role: form.role, dept: form.dept, empresas: form.empresas, centros: form.centros,
      };
      if (id) {
        this.setUsers(list => list.map(x => x.id === id ? Object.assign({}, x, rec, { status: form.active ? (x.status === 'pendente' ? 'pendente' : 'ativo') : 'inativo' }) : x));
        this.toast('Cadastro atualizado.');
      } else {
        this.setUsers(list => [Object.assign({ id: 'n' + Date.now(), status: form.active ? 'pendente' : 'inativo' }, rec)].concat(list));
        this.setState({ uPage: 1 });
        this.toast('Usuário cadastrado · link de definição de senha enviado.');
      }
      this.setState({ modalOpen: false, editingId: null, uForm: null, formErr: '' });
    },

    toastMsg: s.toastMsg,
    toastStyle: `display:${s.toastMsg ? 'flex' : 'none'};align-items:center;gap:9px;position:fixed;left:50%;bottom:28px;z-index:70;padding:11px 16px;border-radius:10px;background:#111827;color:#FFFFFF;font-size:12.5px;font-weight:500;box-shadow:0 18px 40px rgba(9,10,16,.34);animation:toastIn .22s ease-out both;max-width:min(560px,86vw)`,

    iaOpenProg: () => this.setState({ iaPanel: 'prog' }),
    iaOpenFluxo: () => this.setState({ iaPanel: 'fluxo' }),
    iaClose: () => this.setState({ iaPanel: null }),
    iaOverlayStyle: `display:${s.iaPanel ? 'flex' : 'none'};position:fixed;inset:0;z-index:110;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(2px);animation:overlayIn .18s ease-out both`,
    iaData: this.iaInsights(s.iaPanel),
  };
}
