import { Component } from 'react';
import { usersVals } from './vals/usuarios';
import { deptsVals } from './vals/departamentos';
import { perfisVals } from './vals/perfis';
import { saldosVals } from './vals/saldos';
import { lancVals } from './vals/lancamentos';
import { progVals } from './vals/programacao';
import { fluxoVals } from './vals/fluxo';
import { renderVals } from './vals/shell';
import { isLive, supabase } from '../lib/supabase';
import { todayIso, addDays, isoDate, usuariosApi, cadastrosApi, apoioApi } from '../lib/api';
import {
  loadCatalogs, rangeData, neededRanges, ensureRanges, empresaById, empresaNome,
  readSaldos, writeSaldos, saldoPorEmpresa, loadLanc, loadFxSemRec,
} from './data';
import { progInsights, fluxoInsights, iaContextoProg, iaContextoFluxo } from './insights';

export class AppLogic extends Component<any, any> {
  // Memoized seeds and timers are attached as ad-hoc fields, as in the prototype.
  [key: string]: any;

  state: any = {
    view: 'home',
    module: 'Painel',
    bgMode: 'image',
    bgUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2200&q=70',
    bgCustom: false,
    bgOpen: false,
    bgColor: '#161826',
    place: 'Localizando…',
    temp: null,
    wkind: 'sun',
    wlabel: '',
    collapsed: false,
    financeiroOpen: true,
    rhOpen: false,
    permutasOpen: false,
    vendasOpen: false,
    configOpen: false,
    userMenuOpen: false,
    pickerOpen: null,
    pickerQuery: '',
    period: '7D',
    hoverKey: null,
    chartMounted: false,
    aiLoading: false,
    aiVariant: 0,
    selectedEmpresa: null,
    selectedGrupos: [],
    lineHover: null,
    page: 'dashboard',
    users: null,
    uSearch: '',
    uRole: 'Todas as funções',
    uDept: 'Todos os departamentos',
    uEmpF: 'Todas as empresas',
    uStatus: 'Todos',
    uPage: 1,
    modalOpen: false,
    editingId: null,
    uForm: null,
    formErr: '',
    depts: null,
    dSearch: '',
    dStatus: 'Todos',
    deptModalOpen: false,
    editingDeptId: null,
    dForm: null,
    pSearch: '',
    pStatus: 'Todos',
    perfilModalOpen: false,
    editingPerfilId: null,
    pForm: null,
    pFormErr: '',
    deptFormErr: '',
    toastMsg: '',
    iaPanel: null,
    // Fluxo de caixa: empresas sem recebíveis ({ cd, motivo }) e a modal da engrenagem.
    fxSemRec: [],
    fxCfgOpen: false,
    fxCfgDraft: null,
    fxCfgQuery: '',
    fxCfgPick: null,
    fxCfgMotivo: '',
    fxCfgErr: '',
    fxCfgSaving: false,
  };

  uFirst = ['Camila','Rafael','Juliana','Bruno','Patrícia','Diego','Fernanda','Marcelo','Aline','Thiago','Luciana','Gustavo','Renata','Eduardo','Mariana','Felipe','Tatiane','André','Priscila','Vinícius','Carolina'];

  uLast = ['Duarte','Andrade','Moreira','Barbosa','Carvalho','Nogueira','Sampaio','Tavares','Rezende','Fontes','Pacheco'];

  uLast2 = ['Ribeiro','Lima','Souza','Almeida','Prado','Vieira','Machado','Correia','Bastos'];

  demoRoles = ['Administrador','Gestor Financeiro','Analista Financeiro','Analista de RH','Comercial','Jurídico','Controladoria','Suporte'];

  demoDepts = ['Financeiro','RH','Comercial','Jurídico','Obras','TI','Controladoria'];

  /** "Função" options: active profiles from app_perfis in live mode. */
  get uRoles(): string[] {
    if (!this.live) return this.demoRoles;
    return (this.state.perfis || []).filter(p => p.active).map(p => p.name);
  }

  /** Department options: active rows of app_departamentos in live mode. */
  get uDepts(): string[] {
    if (!this.live) return this.demoDepts;
    return (this.state.depts || []).filter(d => d.active).map(d => d.name);
  }

  /** Loads app_perfis and app_departamentos into the screens' shapes. */
  async loadCadastros() {
    try {
      const [perfis, depts] = await Promise.all([cadastrosApi.perfis(), cadastrosApi.departamentos()]);
      this.setState({
        perfis: perfis.map(p => ({ id: p.id, name: p.nome, desc: p.descricao || '', active: p.ativo, perms: { ...this.emptyPermMap(), ...(p.permissoes || {}) }, sistema: p.sistema })),
        depts: depts.map(d => ({ id: d.id, name: d.nome, desc: d.descricao || '', active: d.ativo })),
      });
    } catch (e: any) {
      this.toast('Não foi possível carregar perfis e departamentos: ' + e.message);
    }
  }

  /** Runs a write against an app_* table, then reloads; returns true on success. */
  async cadastroAcao(fn: () => Promise<unknown>, okMsg: string, reload: () => Promise<void>, onError?: (msg: string) => void): Promise<boolean> {
    try {
      await fn();
      await reload();
      this.toast(okMsg);
      return true;
    } catch (e: any) {
      if (onError) onError(e.message); else this.toast(e.message);
      return false;
    }
  }

  /** Signed-in user's profile (app_usuarios.funcao → app_perfis), or null while loading. */
  meuPerfil(): any {
    const uid = this.props.session?.user?.id;
    const me = (this.state.users || []).find(u => u.id === uid);
    return me ? (this.state.perfis || []).find(p => p.name === me.role) || null : null;
  }

  /** Menu permission from the user's profile. Demo mode and "still loading" allow. */
  pode(path: string, editar = false): boolean {
    if (!this.live) return true;
    if (!this.state.users || !this.state.perfis) return !editar;
    const p = this.meuPerfil();
    if (!p || !p.active) return false;
    if (p.sistema) return true;
    const perm = p.perms?.[path];
    return !!(perm && (editar ? perm.edit : perm.view));
  }

  /** Page → menu permission key (Painel has none). */
  pagePerm: Record<string, string> = {
    saldos: 'financeiro.saldos', lancamentos: 'financeiro.lancamentos', programacao: 'financeiro.programacao', fluxo: 'financeiro.fluxo',
    usuarios: 'configuracoes.usuarios', departamentos: 'configuracoes.departamentos', perfis: 'configuracoes.perfis',
  };

  /** Toast + false when the profile cannot edit this menu (the database enforces it too). */
  podeEditar(path: string): boolean {
    if (this.pode(path, true)) return true;
    this.toast('Seu perfil não tem permissão para alterar este cadastro.');
    return false;
  }

  uCentros = ['01 · Obras','02 · Pós-obra','03 · Administrativo','04 · Incorporação','05 · Comercial','06 · Jurídico'];

  uPerPage = 25;

  slugParts(n) {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
  }

  /** Empresas offered in the user form/filters: Supabase catalog in live mode. */
  userEmpresas(): { id: string; n: string; c: string }[] {
    if (!this.live) return this.empresas;
    const pal = ['#4161FF', '#43B997', '#7C3AED', '#F59E0B', '#EC4899', '#0EA5E9'];
    return Object.values(this.empresaById()).map((e: any, i) => ({ id: String(e.id), n: e.label, c: pal[i % pal.length] }));
  }

  /** Centros de custo as "id · nome": Supabase catalog in live mode. */
  userCentros(): string[] {
    if (!this.live) return this.uCentros;
    return (this.state.dbCentros || []).map(c => `${c.id} · ${c.nome}`);
  }

  /** Loads app_usuarios into the Users screen (shape of the prototype's seed). */
  async loadUsuarios() {
    try {
      const rows = await usuariosApi.listar();
      const emp = this.empresaById();
      const cc = Object.fromEntries((this.state.dbCentros || []).map(c => [c.id, `${c.id} · ${c.nome}`]));
      this.setState({
        users: rows.map(r => ({
          id: r.id, name: r.nome, email: r.email, phone: r.telefone || '—', role: r.funcao, dept: r.departamento || '—',
          empresas: r.empresas.map(id => emp[id]?.label || `Empresa ${id}`),
          centros: r.centros_custo.map(id => cc[id] || `${id} · Centro ${id}`),
          status: r.status,
        })),
      });
    } catch (e: any) {
      this.toast('Não foi possível carregar os usuários: ' + e.message);
    }
  }

  /** Runs an app-usuarios edge function action; returns true on success. */
  async usuarioAcao(acao: string, payload: Record<string, unknown>, okMsg: string, onError?: (msg: string) => void): Promise<boolean> {
    try {
      await usuariosApi.acao(acao, payload);
      this.toast(okMsg);
      await this.loadUsuarios();
      return true;
    } catch (e: any) {
      if (onError) onError(e.message); else this.toast(e.message);
      return false;
    }
  }

  empresaIdsFromLabels(labels: string[]): number[] {
    const byLabel = new Map(Object.values(this.empresaById()).map((e: any) => [e.label, e.id]));
    return labels.map(l => byLabel.get(l)).filter((n): n is number => typeof n === 'number');
  }

  seedUsers() {
    if (this._seed) return this._seed;
    if (this.live) return []; // loaded from app_usuarios by loadUsuarios()
    const out: any[] = [];
    for (let i = 0; i < 63; i++) {
      const name = `${this.uFirst[i % this.uFirst.length]} ${this.uLast[(i * 3) % this.uLast.length]} ${this.uLast2[(i * 5) % this.uLast2.length]}`;
      const p = this.slugParts(name);
      const emps = this.empresas.filter((e, j) => (i + j * 2) % 3 === 0).map(e => e.n);
      const cc = this.uCentros.filter((c, j) => (i + j * 3) % 4 !== 0);
      out.push({
        id: 'u' + (i + 1),
        name,
        email: `${p[0]}.${p[2]}@horizonte.com.br`,
        phone: `(${11 + (i % 9)}) 9${String(1000 + ((i * 4391) % 8999))}-${String(1000 + ((i * 7919) % 8999))}`,
        role: this.uRoles[(i * 5) % this.uRoles.length],
        dept: this.uDepts[(i * 3) % this.uDepts.length],
        empresas: emps.length ? emps : [this.empresas[i % this.empresas.length].n],
        centros: cc.length ? cc : [this.uCentros[i % this.uCentros.length]],
        status: i % 13 === 0 ? 'pendente' : (i % 9 === 0 ? 'inativo' : 'ativo'),
      });
    }
    this._seed = out;
    return out;
  }

  mkDropdown(key, s, value, options, onChange) {
    const open = s.ddOpen === key;
    const hasSearch = options.length > 8;
    const query = (s.ddQuery || '').toLowerCase();
    const filtered = hasSearch && query ? options.filter(o => o.toLowerCase().includes(query)) : options;
    return {
      isOpen: open,
      label: value,
      hasSearch,
      query: s.ddQuery || '',
      onQuery: e => this.setState({ ddQuery: e.target.value }),
      noResultStyle: `display:${filtered.length ? 'none' : 'block'};padding:10px;font-size:12px;color:#94A3B8;text-align:center`,
      toggle: e => { e.stopPropagation(); this.setState(st => ({ ddOpen: st.ddOpen === key ? null : key, ddQuery: '' })); },
      btnStyle: `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;height:36px;padding:0 10px;border-radius:8px;border:1px solid ${open ? '#4161FF' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;cursor:pointer;box-shadow:${open ? '0 0 0 3px rgba(65,97,255,.14)' : 'none'};transition:border-color .15s,box-shadow .15s`,
      chevStyle: `transition:transform .15s;transform:rotate(${open ? 180 : 0}deg);flex:none`,
      panelStyle: 'position:absolute;top:calc(100% + 6px);left:0;min-width:100%;width:max-content;max-width:260px;z-index:80;background:#FFFFFF;border-radius:10px;border:1px solid #EEEEF1;box-shadow:0 14px 34px rgba(9,10,16,.16);padding:6px;display:flex;flex-direction:column;gap:1px;max-height:300px;overflow-y:auto;animation:modalIn .15s ease-out both',
      items: filtered.map(o => ({
        label: o,
        selected: o === value,
        // preventDefault: the list sits inside a <label>, whose activation would re-click the toggle button.
        onClick: e => { e.stopPropagation(); e.preventDefault(); onChange(o); this.setState({ ddOpen: null, ddQuery: '' }); },
        style: `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:7px;font-size:12.5px;font-weight:${o === value ? 600 : 500};color:${o === value ? '#4161FF' : '#374151'};background:${o === value ? '#EAF1FF' : 'transparent'};cursor:pointer;transition:background .12s;white-space:nowrap`,
        hoverStyle: `background:${o === value ? '#EAF1FF' : '#F4F4F6'}`,
      })),
    };
  }

  // Multi-select company filter: searchable + scrollable checkbox list, for use with a large (Supabase-backed) company catalog.
  mkMultiDropdown(key, s, selected, catalog, onToggle, onSetMany?) {
    const open = s.ddOpen === key;
    const hasSearch = catalog.length > 6;
    const query = (s.ddQuery || '').trim().toLowerCase();
    const filtered = hasSearch && query ? catalog.filter(c => c.name.toLowerCase().includes(query)) : catalog;
    const allOn = catalog.length > 0 && selected.length === catalog.length;
    return {
      isOpen: open,
      label: catalog.length === 0 ? 'Todas as empresas' : (allOn ? 'Todas as empresas' : (selected.length ? `${selected.length} selecionada${selected.length > 1 ? 's' : ''}` : 'Nenhuma empresa')),
      hasSearch,
      query: s.ddQuery || '',
      onQuery: e => this.setState({ ddQuery: e.target.value }),
      toggle: e => { e.stopPropagation(); this.setState(st => ({ ddOpen: st.ddOpen === key ? null : key, ddQuery: '' })); },
      btnStyle: `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;height:36px;padding:0 10px;border-radius:8px;border:1px solid ${open ? '#4161FF' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;cursor:pointer;box-shadow:${open ? '0 0 0 3px rgba(65,97,255,.14)' : 'none'};transition:border-color .15s,box-shadow .15s`,
      chevStyle: `transition:transform .15s;transform:rotate(${open ? 180 : 0}deg);flex:none`,
      panelStyle: 'position:absolute;top:calc(100% + 6px);left:0;min-width:260px;width:max-content;max-width:300px;z-index:80;background:#FFFFFF;border-radius:10px;border:1px solid #EEEEF1;box-shadow:0 14px 34px rgba(9,10,16,.16);padding:8px;display:flex;flex-direction:column;gap:6px;animation:modalIn .15s ease-out both',
      listStyle: 'max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:1px',
      noResultStyle: `display:${filtered.length ? 'none' : 'block'};padding:10px;font-size:12px;color:#94A3B8;text-align:center`,
      allOnLabel: allOn ? 'Limpar seleção' : 'Selecionar todas',
      toggleAllVisible: e => {
        e.stopPropagation();
        const names = filtered.map(c => c.name);
        const allVisOn = names.every(n => selected.indexOf(n) >= 0);
        // Batch update: calling onToggle in a loop reuses the same stale `selected`, so only the last toggle would stick.
        if (onSetMany) onSetMany(allVisOn ? selected.filter(n => names.indexOf(n) < 0) : selected.concat(names.filter(n => selected.indexOf(n) < 0)));
        else if (allVisOn) names.forEach(n => onToggle(n));
        else names.forEach(n => { if (selected.indexOf(n) < 0) onToggle(n); });
      },
      items: filtered.map(c => {
        const on = selected.indexOf(c.name) >= 0;
        return {
          name: c.name,
          onClick: e => { e.stopPropagation(); e.preventDefault(); onToggle(c.name); },
          style: `display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;font-size:12.5px;font-weight:${on ? 600 : 500};color:${on ? '#1E3AE0' : '#374151'};background:${on ? '#EAF1FF' : 'transparent'};cursor:pointer;transition:background .12s`,
          hoverStyle: `background:${on ? '#EAF1FF' : '#F4F4F6'}`,
          boxStyle: `flex:none;width:16px;height:16px;border-radius:4px;border:1.5px solid ${on ? '#4161FF' : '#CBD5E1'};background:${on ? '#4161FF' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;transition:all .12s`,
          checkStyle: `display:${on ? 'block' : 'none'}`,
        };
      }),
    };
  }

  // Simulates fetching + searching a Supabase table (Empresas / centro_custos) to link records by id or name.
  mkPicker(key, s, selected, catalog, onToggle) {
    const open = s.pickerOpen === key;
    const query = (s.pickerQuery || '').trim().toLowerCase();
    const filtered = query ? catalog.filter(c => c.id.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)) : catalog;
    return {
      isOpen: open,
      query: s.pickerQuery || '',
      onQuery: e => this.setState({ pickerQuery: e.target.value }),
      toggle: e => { e.stopPropagation(); this.setState(st => ({ pickerOpen: st.pickerOpen === key ? null : key, pickerQuery: '' })); },
      panelStyle: 'width:100%;background:#FAFAFB;border-radius:10px;border:1px solid #EEEEF1;padding:10px;display:flex;flex-direction:column;gap:8px;animation:modalIn .15s ease-out both',
      listStyle: 'max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:2px',
      noResultStyle: `display:${filtered.length ? 'none' : 'block'};padding:12px 10px;font-size:12px;color:#94A3B8;text-align:center`,
      allOnLabel: selected.length === catalog.length ? 'Limpar seleção' : 'Selecionar todos',
      toggleAllVisible: e => {
        e.stopPropagation();
        const visibleNames = filtered.map(c => c.name);
        const allVisibleOn = visibleNames.every(n => selected.indexOf(n) >= 0);
        if (allVisibleOn) visibleNames.forEach(n => onToggle(n));
        else visibleNames.forEach(n => { if (selected.indexOf(n) < 0) onToggle(n); });
      },
      items: filtered.map(c => {
        const on = selected.indexOf(c.name) >= 0;
        return {
          id: c.id,
          name: c.name,
          onClick: e => { e.stopPropagation(); e.preventDefault(); onToggle(c.name); },
          style: `display:flex;align-items:flex-start;gap:9px;padding:8px 9px;border-radius:7px;font-size:12.5px;font-weight:${on ? 600 : 500};color:${on ? '#1E3AE0' : '#374151'};background:${on ? '#EAF1FF' : 'transparent'};cursor:pointer;transition:background .12s`,
          hoverStyle: `background:${on ? '#EAF1FF' : '#F4F4F6'}`,
          idBadgeStyle: `flex:none;margin-top:1px;min-width:30px;padding:2px 6px;border-radius:5px;background:${on ? '#DCE6FF' : '#F1F1F4'};color:${on ? '#2445E8' : '#94A3B8'};font-size:10px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums`,
          checkboxStyle: `flex:none;margin-top:1px;width:16px;height:16px;border-radius:4px;border:1.5px solid ${on ? '#4161FF' : '#CBD5E1'};background:${on ? '#4161FF' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;transition:all .12s`,
          selected: on,
        };
      }),
    };
  }

  goSaldosFromIa() {
    this.setState({ iaPanel: null, view: 'app', page: 'saldos', module: 'Financeiro', financeiroOpen: true });
    this.startSbAnim();
  }

  /**
   * Asks the app-ia edge function (LLM) for the panel's analysis. Until it answers, or when
   * the model is not configured (503), the panel shows the rule-based analysis.
   */
  async askIa(panel: 'prog' | 'fluxo') {
    if (!this.live || this.state.iaOff) return;
    const rules = panel === 'prog' ? progInsights(this) : fluxoInsights(this);
    const contexto = panel === 'prog' ? iaContextoProg(this) : iaContextoFluxo(this);
    const key = JSON.stringify(contexto);
    const cur = (this.state.iaRemote || {})[panel];
    if (cur && cur.key === key && cur.status !== 'error') return;
    const put = (v: any) => this.setState(st => ({ iaRemote: { ...(st.iaRemote || {}), [panel]: v } }));
    put({ key, status: 'loading' });
    try {
      const data = await apoioApi.ia(panel, contexto, rules.items.map(i => ({ label: i.label, text: i.text })));
      put({ key, status: 'ready', data });
    } catch (e: any) {
      if (e.status === 503) this.setState({ iaOff: true });
      put({ key, status: 'error', error: e.message });
    }
  }

  /** LLM answer for the panel when it matches the current data, else null. */
  iaRemoteFor(panel: 'prog' | 'fluxo') {
    const r = (this.state.iaRemote || {})[panel];
    return r && r.status === 'ready' ? r.data : null;
  }

  iaInsights(panel) {
    if (this.live && (panel === 'prog' || panel === 'fluxo')) {
      const r = panel === 'prog' ? progInsights(this) : fluxoInsights(this);
      const remote = this.iaRemoteFor(panel);
      const loading = (this.state.iaRemote || {})[panel]?.status === 'loading';
      const cor = { critico: '#EF4444', atencao: '#F59E0B', info: '#94A3B8', positivo: '#43B997' };
      if (remote) {
        return {
          title: r.title, subtitle: `Gerada por IA (${remote.modelo}) sobre os dados do período.`,
          items: remote.items.map(i => ({
            label: i.label, text: i.text, action: '',
            onAction: () => this.setState({ iaPanel: null }),
            style: 'padding:12px;border-radius:9px;background:#FAFAFB;box-shadow:0 0 0 1px #EEEEF1',
            dotStyle: `width:7px;height:7px;border-radius:50%;background:${cor[i.nivel] || '#94A3B8'};flex:none`,
          })),
        };
      }
      return {
        title: r.title, subtitle: loading ? 'Consultando o modelo de IA… enquanto isso, a análise por regras:' : r.subtitle,
        items: r.items.map(i => ({
          label: i.label, text: i.text, action: i.action || '',
          onAction: i.go || (() => this.setState({ iaPanel: null })),
          style: 'padding:12px;border-radius:9px;background:#FAFAFB;box-shadow:0 0 0 1px #EEEEF1',
          dotStyle: `width:7px;height:7px;border-radius:50%;background:${i.color};flex:none`,
        })),
      };
    }
    const item = (label, text, color, action?, onAction?) => ({
      label, text, action,
      onAction: onAction || (() => this.toast('Ação em construção.')),
      style: `padding:12px;border-radius:9px;background:#FAFAFB;box-shadow:0 0 0 1px #EEEEF1`,
      dotStyle: `width:7px;height:7px;border-radius:50%;background:${color};flex:none`,
    });
    if (panel === 'prog') {
      return {
        title: 'Análise com IA · Programação do dia',
        subtitle: 'Baseada nos pagamentos e no saldo inicial de hoje.',
        items: [
          item('Saldo insuficiente', 'A conta Itaú · Obras Ltda tem R$ 62.100 disponíveis, mas R$ 80.500 em pagamentos previstos para hoje. Faltam R$ 18.400.', '#EF4444', 'Ver saldos bancários', () => this.goSaldosFromIa()),
          item('Pagamento fora do padrão', 'O lançamento "Consultoria jurídica" de R$ 22.000 é 4x maior que a média dos últimos 3 meses para essa categoria.', '#F59E0B', 'Ver lançamento'),
          item('Vencimento hoje com desconto', 'A parcela do fornecedor Cimentos Vale tem 1,5% de desconto se paga até hoje, e vence a partir de amanhã.', '#43B997', 'Ver título'),
        ],
      };
    }
    if (panel === 'fluxo') {
      return {
        title: 'Análise com IA · Fluxo de caixa',
        subtitle: 'Projeção para os próximos 10 dias, por empresa.',
        items: [
          item('Saldo negativo projetado', 'Em 28/09 o saldo consolidado fica negativo em R$ 142 mil, puxado pela SPE Residencial Aurora. Recomenda-se antecipar recebíveis ou negociar prazos.', '#EF4444', 'Ver dia 28/09'),
          item('Concentração de saídas', '38% das saídas do período estão nos dias 25 e 26/09, contra uma média de 14% por dia. Considere reprogramar pagamentos não críticos.', '#F59E0B', 'Ver detalhamento'),
          item('Abaixo do previsto', 'As receitas realizadas estão 9% abaixo do previsto para o período, principalmente em recebimentos de clientes.', '#94A3B8', 'Comparar com previsão'),
        ],
      };
    }
    return { title: '', subtitle: '', items: [] };
  }

  toast(msg) {
    this.setState({ toastMsg: msg });
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setState({ toastMsg: '' }), 2800);
  }

  dSeedDescs = {
    'Financeiro': 'Controle de fluxo de caixa, contas a pagar e a receber.',
    'RH': 'Recrutamento, folha de pagamento e benefícios.',
    'Comercial': 'Vendas, relacionamento com clientes e propostas.',
    'Jurídico': 'Contratos, compliance e questões regulatórias.',
    'Obras': 'Execução e acompanhamento de obras em andamento.',
    'TI': 'Infraestrutura, sistemas e suporte técnico.',
    'Controladoria': 'Auditoria interna e relatórios gerenciais.',
  };

  seedDepts() {
    if (this.live) return [];
    if (this._deptSeed) return this._deptSeed;
    this._deptSeed = this.demoDepts.map((name, i) => ({ id: 'd' + (i + 1), name, desc: this.dSeedDescs[name] || '', active: true }));
    return this._deptSeed;
  }

  emptyDeptForm() {
    return { name: '', desc: '', active: true };
  }

  patchDeptForm(patch) {
    this.setState(st => ({ dForm: Object.assign({}, st.dForm || this.emptyDeptForm(), patch), deptFormErr: '' }));
  }

  setDepts(fn) {
    this.setState(st => ({ depts: fn((st.depts || this.seedDepts()).slice()) }));
  }

  permModules = [
    { key: 'financeiro', label: 'Financeiro', subs: [
      { key: 'saldos', label: 'Saldos bancários' },
      { key: 'lancamentos', label: 'Lançamentos manuais' },
      { key: 'programacao', label: 'Programação do dia' },
      { key: 'fluxo', label: 'Fluxo de caixa' },
    ] },
    { key: 'rh', label: 'RH', subs: [
      { key: 'colaboradores', label: 'Colaboradores' },
      { key: 'folha', label: 'Folha de Pagamento' },
    ] },
    { key: 'veiculos', label: 'Veículos', subs: [] },
    { key: 'permutas', label: 'Permutas', subs: [
      { key: 'cadastro', label: 'Cadastro' },
      { key: 'acompanhamento', label: 'Acompanhamento' },
    ] },
    { key: 'vendas', label: 'Vendas', subs: [
      { key: 'propostas', label: 'Propostas' },
      { key: 'contratos', label: 'Contratos' },
    ] },
    { key: 'cobranca', label: 'Cobrança', subs: [] },
    { key: 'juridico', label: 'Jurídico', subs: [] },
    { key: 'crc', label: 'CRC', subs: [] },
    { key: 'configuracoes', label: 'Configurações', subs: [
      { key: 'usuarios', label: 'Usuários' },
      { key: 'departamentos', label: 'Departamentos' },
      { key: 'perfis', label: 'Perfis' },
      { key: 'auditoria', label: 'Auditoria' },
    ] },
    { key: 'cadastros', label: 'Cadastros', subs: [
      { key: 'clientes', label: 'Clientes' },
      { key: 'fornecedores', label: 'Fornecedores' },
      { key: 'imoveis', label: 'Imóveis' },
      { key: 'contratos', label: 'Contratos' },
    ] },
  ];

  permPaths() {
    const paths: any[] = [];
    this.permModules.forEach(m => {
      if (m.subs.length === 0) paths.push(m.key);
      else m.subs.forEach(sub => paths.push(m.key + '.' + sub.key));
    });
    return paths;
  }

  emptyPermMap() {
    const map: any = {};
    this.permPaths().forEach(p => { map[p] = { view: false, edit: false }; });
    return map;
  }

  permCombine(...specs) {
    const map = this.emptyPermMap();
    specs.forEach(([paths, edit]) => paths.forEach(p => { if (map[p]) map[p] = { view: true, edit: !!edit }; }));
    return map;
  }

  seedPerfis() {
    if (this.live) return [];
    if (this._perfilSeed) return this._perfilSeed;
    const all = this.permPaths();
    this._perfilSeed = [
      { id: 'p1', name: 'Administrador', desc: 'Acesso total a todos os módulos e submódulos do sistema.', active: true, perms: this.permCombine([all, true]) },
      { id: 'p2', name: 'Financeiro', desc: 'Gestão de caixa, lançamentos e fluxo financeiro.', active: true, perms: this.permCombine([['financeiro.saldos', 'financeiro.lancamentos', 'financeiro.programacao', 'financeiro.fluxo'], true]) },
      { id: 'p3', name: 'Comercial', desc: 'Propostas, contratos de venda e relacionamento com cliente.', active: true, perms: this.permCombine([['vendas.propostas', 'vendas.contratos', 'crc'], true], [['financeiro.saldos'], false]) },
      { id: 'p4', name: 'Suporte financeiro', desc: 'Consulta ao caixa do setor financeiro, sem acesso ao CRC.', active: false, perms: this.permCombine([['financeiro.saldos'], false]) },
    ];
    return this._perfilSeed;
  }

  setPerfis(fn) {
    this.setState(st => ({ perfis: fn((st.perfis || this.seedPerfis()).slice()) }));
  }

  emptyPerfilForm() {
    return { name: '', desc: '', active: true, perms: this.emptyPermMap() };
  }

  patchPerfilForm(patch) {
    this.setState(st => ({ pForm: Object.assign({}, st.pForm || this.emptyPerfilForm(), patch), pFormErr: '' }));
  }

  sbBanks = {
    'Itaú': { c: '#EC7000', s: 'IT' },
    'Banco do Brasil': { c: '#B38B00', s: 'BB' },
    'Bradesco': { c: '#CC092F', s: 'BR' },
    'Santander': { c: '#E30613', s: 'SA' },
  };

  sbSeed() {
    if (this._sbSeed) return this._sbSeed;
    const P = ['Pag.'], R = ['Rec.'], PR = ['Pag.', 'Rec.'], N = [];
    const rows = [
      [2, 'Habitat Construtora e Incorp.', 'Itaú', '1589', '22190-4', PR, 1102.14, '23/09 08:19', 'ok'],
      [10, 'Murilo PF', 'Banco do Brasil', '0221', '0221-6', P, 42.45, '22/09 17:40', 'ok'],
      [120, 'SPE New Life', 'Bradesco', '3684', '8842-0', PR, 192.19, '23/09 08:19', 'ok'],
      [120, 'SPE New Life', 'Itaú', '1589', '47504-3', N, 86.56, '23/09 08:19', 'ok'],
      [190, 'SPE Jataí I – Libertá', 'Itaú', '1589', '36698-6', P, 293832.69, '23/09 08:19', 'ok'],
      [190, 'SPE Jataí I – Libertá', 'Banco do Brasil', '0221', '7606-6', R, null, '—', 'missing'],
      [191, 'SPE Rio Verde I – Laguna', 'Bradesco', '3684', '3759-1', PR, 150029.59, '23/09 08:02', 'ok'],
      [192, 'SPE Rio Verde II – Raruz', 'Itaú', '1589', '36447-8', P, 326.67, '23/09 08:19', 'ok'],
      [192, 'SPE Rio Verde II – Raruz', 'Santander', '4417', '13032637-2', R, 94.06, '22/09 17:40', 'div'],
      [211, 'SPE Jataí III – Vida', 'Itaú', '1589', '47510-0', N, 129.70, '23/09 08:19', 'ok'],
      [217, 'SPE Rio Verde III – Soul', 'Bradesco', '3684', '2935-1', PR, 51264.50, '23/09 08:02', 'ok'],
      [217, 'SPE Rio Verde III – Soul', 'Banco do Brasil', '0221', '7679-1', N, null, '—', 'missing'],
      [238, 'SPE Rio Verde VII – Zoe', 'Itaú', '1589', '40611-3', PR, 220.24, '23/09 08:19', 'ok'],
      [245, 'SPE Rio Verde VIII – Casa Bosco', 'Itaú', '1589', '40609-7', PR, 47668.45, '23/09 08:19', 'ok'],
      [281, 'SPE Jataí IV – Brisas', 'Itaú', '1589', '51028-6', PR, 2320087.00, '23/09 08:19', 'ok'],
      [282, 'B2 Gestão e Operações', 'Itaú', '1589', '50952-8', P, 81660.17, '23/09 08:19', 'ok'],
    ];
    this._sbSeed = rows.map((r, i) => ({ id: 'sb' + i, cd: r[0], emp: r[1], bank: r[2], ag: r[3], cc: r[4], uso: r[5], saldo: r[6], upd: r[7], status: r[8] }));
    return this._sbSeed;
  }

  setSb(fn) { this.setState(st => ({ sbAccounts: fn(st.sbAccounts || this.sbSeed()) })); }

  startSbAnim() {
    cancelAnimationFrame(this._sbRaf);
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / 900);
      this.setState({ sbT: t });
      if (t < 1) this._sbRaf = requestAnimationFrame(step);
    };
    this.setState({ sbT: 0 });
    this._sbRaf = requestAnimationFrame(step);
  }

  nowStamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  lcCats = ['VMD', 'Fator recompra', 'Juros P.E', 'RET', 'Tarifas bancárias', 'Reembolso', 'Outros'];

  lcSeed() {
    if (this._lcSeed) return this._lcSeed;
    const rows = [
      ['2026-09-23', 2, 'Habitat Construtora e Incorp.', 'Tarifas bancárias mês', 'Tarifas bancárias', 'saida', 1102.14, 'Nenhuma', 1, 'lancado'],
      ['2026-09-23', 190, 'SPE Jataí I – Libertá', 'VMD unidade 1803', 'VMD', 'saida', 8420.30, 'Nenhuma', 1, 'previsto'],
      ['2026-09-24', 191, 'SPE Rio Verde I – Laguna', 'Fator recompra lote 12', 'Fator recompra', 'saida', 4870.00, 'Mensal', 6, 'previsto'],
      ['2026-09-23', 192, 'SPE Rio Verde II – Raruz', 'Juros P.E setembro', 'Juros P.E', 'saida', 326.67, 'Mensal', 12, 'lancado'],
      ['2026-09-25', 238, 'SPE Rio Verde VII – Zoe', 'RET obra fase 2', 'RET', 'saida', 198028.93, 'Nenhuma', 1, 'previsto'],
      ['2026-09-24', 245, 'SPE Rio Verde VIII – Casa Bosco', 'Reembolso condomínio', 'Reembolso', 'entrada', 28500.00, 'Nenhuma', 1, 'lancado'],
      ['2026-09-30', 281, 'SPE Jataí IV – Brisas', 'RET terreno', 'RET', 'saida', 1126243.20, 'Nenhuma', 1, 'previsto'],
      ['2026-10-01', 217, 'SPE Rio Verde III – Soul', 'VMD unidade 902', 'VMD', 'saida', 22415.90, 'Nenhuma', 1, 'previsto'],
      ['2026-09-23', 282, 'B2 Gestão e Operações', 'Reembolso despesas', 'Reembolso', 'entrada', 7300.00, 'Nenhuma', 1, 'lancado'],
      ['2026-10-01', 190, 'SPE Jataí I – Libertá', 'Fator recompra lote 4', 'Fator recompra', 'saida', 204778.59, 'Mensal', 3, 'previsto'],
    ];
    this._lcSeed = rows.map((r, i) => ({ id: 'lc' + i, date: r[0], cd: r[1], emp: r[2], desc: r[3], cat: r[4], tipo: r[5], value: r[6], rec: r[7], parc: r[8], sit: r[9] }));
    return this._lcSeed;
  }

  /** Demo mode only: live entries go through cadastrosApi (see vals/lancamentos.ts). */
  setLc(fn) {
    this.setState(st => ({ lcRowsData: fn(st.lcRowsData || this.lcSeed()) }));
  }

  exportLancCsv(rows: any[]) {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const f2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    const head = ['data', 'cd_empresa', 'empresa', 'descricao', 'categoria', 'tipo', 'valor', 'recorrencia', 'parcela', 'total_parcelas', 'situacao'];
    const lines = [head.join(';')].concat(rows.map(r => [r.date, r.cd, r.emp, r.desc, r.cat, r.tipo, f2(r.value), r.rec, r.parc, r.parcTotal ?? r.parc, r.sit].map(esc).join(';')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'lancamentos.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.toast(`Lançamentos exportados · ${a.download}`);
  }

  pgSeed() {
    if (this._pgSeed) return this._pgSeed;
    this._pgSeed = [
      { cd: 190, emp: 'SPE Jataí I – Libertá', saldo: 293832.69, items: [
        { title: 'Fornecedor Cimento Forte', sub: 'NF 4521 · vence hoje', tag: 'Título', val: 18420.30, on: true },
        { title: 'VMD unidade 1803', sub: 'Lançamento manual', tag: 'Manual', val: 8420.30, on: true },
      ]},
      { cd: 191, emp: 'SPE Rio Verde I – Laguna', saldo: 150029.59, items: [
        { title: 'Empreiteira Alvenaria Sul', sub: 'NF 9012 · vence hoje', tag: 'Título', val: 12131.61, on: true },
      ]},
      { cd: 217, emp: 'SPE Rio Verde III – Soul', saldo: 51264.50, items: [
        { title: 'Fornecedor Elétrica Prime', sub: 'NF 2290 · vence hoje', tag: 'Título', val: 6880.00, on: true },
        { title: 'Aluguel de equipamentos', sub: 'NF 3381 · vence hoje', tag: 'Título', val: 25715.90, on: false },
      ]},
      { cd: 238, emp: 'SPE Rio Verde VII – Zoe', saldo: 220.24, items: [
        { title: 'RET obra fase 2', sub: 'Lançamento manual', tag: 'Manual', val: 198028.93, on: true },
        { title: 'Fornecedor Hidráulica', sub: 'NF 1187 · vence hoje', tag: 'Título', val: 232.00, on: true },
      ]},
      { cd: 245, emp: 'SPE Rio Verde VIII – Casa Bosco', saldo: 47668.45, items: [
        { title: 'Consultoria jurídica', sub: 'NF 7734 · vence hoje', tag: 'Título', val: 28050.00, on: true },
      ]},
    ];
    return this._pgSeed;
  }

  setPg(fn) { this.setState(st => ({ pgGroups: fn(st.pgGroups || this.pgSeed()) })); }

  getDateRangeForPeriod(period) {
    // Local-date math (the prototype used UTC midnight, which shifts a day in Brazil).
    const [y, m, d] = (this.live ? todayIso() : '2026-09-23').split('-').map(Number);
    const today = new Date(y, m - 1, d);
    let from = new Date(today);
    let to = new Date(today);
    if (period === 'Semanal') {
      from = new Date(y, m - 1, d - today.getDay());
      to = new Date(y, m - 1, d - today.getDay() + 6);
    } else if (period === 'Mensal') {
      from = new Date(y, m - 1, 1);
      to = new Date(y, m, 0);
    } else if (period === 'Trimestral') {
      const q = Math.floor((m - 1) / 3);
      from = new Date(y, q * 3, 1);
      to = new Date(y, q * 3 + 3, 0);
    }
    return { pgDateFrom: isoDate(from), pgDateTo: isoDate(to) };
  }


  fxSeed() {
    const empList = [
      { cd: 2, name: 'Habitat Construtora e Incorp.', kind: 'holding' },
      { cd: 190, name: 'SPE Jataí I – Libertá', kind: 'spe' },
      { cd: 191, name: 'SPE Rio Verde I – Laguna', kind: 'spe' },
      { cd: 238, name: 'SPE Rio Verde VII – Zoe', kind: 'spe' },
    ];
    return empList;
  }

  emptyForm() {
    const roles = this.uRoles;
    const role = roles.includes('Analista Financeiro') ? 'Analista Financeiro' : (roles[2] || roles[0] || '');
    return { name: '', email: '', phone: '', role, dept: this.uDepts[0] || '', empresas: [], centros: [], active: true };
  }

  patchForm(patch) {
    this.setState(st => ({ uForm: Object.assign({}, st.uForm || this.emptyForm(), patch), formErr: '' }));
  }

  setUsers(fn) {
    this.setState(st => ({ users: fn((st.users || this.seedUsers()).slice()) }));
  }

  empresas = [
    { id:'1', n:'Horizonte Incorporações', s:'HI', c:'#4161FF', g:{ 'Obras':412000, 'Pós-obra':86000, 'Administrativo':134000, 'Incorporação':228000, 'Comercial':74000 } },
    { id:'2', n:'Vertha Construtora',      s:'VC', c:'#43B997', g:{ 'Obras':356000, 'Pós-obra':112000, 'Administrativo':98000, 'Incorporação':141000, 'Comercial':52000 } },
    { id:'3', n:'Solar Empreendimentos',   s:'SE', c:'#7C3AED', g:{ 'Obras':268000, 'Pós-obra':64000, 'Administrativo':121000, 'Incorporação':186000, 'Comercial':63000 } },
    { id:'4', n:'Atrium Patrimonial',      s:'AP', c:'#F59E0B', g:{ 'Obras':154000, 'Pós-obra':41000, 'Administrativo':87000, 'Incorporação':96000, 'Comercial':38000 } },
    { id:'5', n:'Nova Marca Urbanismo',    s:'NM', c:'#EC4899', g:{ 'Obras':121000, 'Pós-obra':33000, 'Administrativo':56000, 'Incorporação':74000, 'Comercial':29000 } },
    { id:'6', n:'Cedro Participações',     s:'CP', c:'#0EA5E9', g:{ 'Obras':64000, 'Pós-obra':22000, 'Administrativo':73000, 'Incorporação':41000, 'Comercial':18000 } },
  ];

  grupoOrder = ['Obras','Pós-obra','Administrativo','Incorporação','Comercial'];

  grupoColors = { 'Obras':'#4161FF', 'Pós-obra':'#43B997', 'Administrativo':'#F59E0B', 'Incorporação':'#7C3AED', 'Comercial':'#EC4899' };

  periodFactor = { D:0.07, '7D':1, '30D':4.1, '90D':12.4 };

  parcelas = [
    { d:'08', m:'set', wd:'terça',  emp:'Horizonte Incorp.', desc:'Empreiteira Vega · medição 07', v:186400, st:'Vence hoje',   tone:'#EF4444', urgent:true },
    { d:'11', m:'set', wd:'sexta',  emp:'Vertha Construtora', desc:'Concreteira Almeida · NF 4412', v:94200,  st:'em 3 dias',    tone:'#F59E0B', urgent:false },
    { d:'15', m:'set', wd:'terça',  emp:'Solar Empreend.',    desc:'Folha administrativa · set/1', v:212800, st:'em 7 dias',    tone:'#4161FF', urgent:false },
    { d:'20', m:'set', wd:'domingo',emp:'Atrium Patrimonial', desc:'ITBI lote 14 · parcela 2/6',   v:48300,  st:'em 12 dias',   tone:'#4161FF', urgent:false },
    { d:'25', m:'set', wd:'sexta',  emp:'Horizonte Incorp.',  desc:'Financiamento Plano Empresário', v:341900, st:'em 17 dias', tone:'#7C3AED', urgent:false },
    { d:'02', m:'out', wd:'sexta',  emp:'Nova Marca Urban.',  desc:'Projeto arquitetônico · 3/4',  v:67500,  st:'em 24 dias',   tone:'#43B997', urgent:false },
    { d:'08', m:'out', wd:'quinta', emp:'Cedro Particip.',    desc:'Consultoria tributária',       v:29800,  st:'em 30 dias',   tone:'#43B997', urgent:false },
  ];

  fmtK(v) {
    if (v >= 1000000) return 'R$ ' + (v / 1000000).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1000) return 'R$ ' + Math.round(v / 1000) + 'k';
    return 'R$ ' + Math.round(v);
  }

  buildResumo(tone, totPago, totJuros, totDesc, topEmp, topGrupo, periodLabel, due?: { count: number; value: number; next10: number }) {
    const f = this.fmtBRL.bind(this);
    const liquido = totPago + totJuros - totDesc;
    if (tone === 'Analítico') {
      return `No recorte ${periodLabel.toLowerCase()}, o desembolso bruto foi de ${f(totPago)}, acrescido de ${f(totJuros)} em juros (${(totPago ? totJuros / totPago * 100 : 0).toFixed(1)}%) e reduzido por ${f(totDesc)} em descontos negociados — efeito líquido de ${f(liquido)}. ${topEmp} responde pela maior fatia e ${topGrupo} é o segmento dominante; antecipar as parcelas de setembro tende a converter parte dos juros em desconto.`;
    }
    if (tone === 'Direto') {
      return `Pago: ${f(totPago)}. Juros: ${f(totJuros)}. Descontos: ${f(totDesc)}. Maior empresa: ${topEmp}. Maior segmento: ${topGrupo}. ${!due ? `Próximo vencimento crítico hoje, ${f(186400)}.` : due.count ? `Vencendo hoje: ${due.count} ${due.count === 1 ? 'parcela' : 'parcelas'}, ${f(due.value)}.` : 'Nenhuma parcela vence hoje.'}`;
    }
    return `Você pagou ${f(totPago)} no período, com ${f(totJuros)} de juros e ${f(totDesc)} economizados em descontos. ${topEmp} concentra o maior volume e ${topGrupo} lidera entre os segmentos. ${due ? this.dueSentence(due) : 'Há uma parcela vencendo hoje e três nos próximos dez dias — quitá-las antecipadamente mantém a curva de juros em queda.'}`;
  }

  targets = { receber: 48200, pagar: 21400, saldo: 386900, previsao: 154300 };

  periodDefs = [
    { key: 'D', label: 'Dia' },
    { key: '7D', label: '7 dias' },
    { key: '30D', label: '30 dias' },
    { key: '90D', label: '90 dias' },
  ];

  periodsData = {
    D: { label: 'Diário', sub: 'Entradas vs. saídas · hoje', data: [
      { x: 'Hoje', in: 48200, out: 21400 },
    ]},
    '7D': { label: 'Semanal', sub: 'Entradas vs. saídas · últimos 7 dias', data: [
      { x: 'Seg', in: 32000, out: 21000 }, { x: 'Ter', in: 38000, out: 24000 }, { x: 'Qua', in: 29000, out: 26000 },
      { x: 'Qui', in: 44000, out: 23000 }, { x: 'Sex', in: 51000, out: 31000 }, { x: 'Sáb', in: 19000, out: 12000 }, { x: 'Dom', in: 11000, out: 8000 },
    ]},
    '30D': { label: 'Mensal', sub: 'Entradas vs. saídas · últimas 5 semanas', data: [
      { x: 'Sem 1', in: 186000, out: 132000 }, { x: 'Sem 2', in: 204000, out: 141000 }, { x: 'Sem 3', in: 171000, out: 128000 },
      { x: 'Sem 4', in: 229000, out: 156000 }, { x: 'Sem 5', in: 98000, out: 71000 },
    ]},
    '90D': { label: 'Trimestral', sub: 'Entradas vs. saídas · últimos 3 meses', data: [
      { x: 'Mês -2', in: 812000, out: 588000 }, { x: 'Mês -1', in: 874000, out: 612000 }, { x: 'Mês atual', in: 601000, out: 441000 },
    ]},
  };

  homeModules = {
    operacao: [
      { name:'Financeiro', sub:'Contas, tesouraria e fluxo', c:'#4161FF', d:'M3 6h18v12H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5' },
      { name:'RH', sub:'Colaboradores e folha', c:'#43B997', d:'M9 5a3 3 0 100 6 3 3 0 000-6M3 20c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3M17 6.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8M15.6 14.5c2.4.3 4.2 2.1 4.2 5' },
      { name:'Veículos', sub:'Frota e manutenção', c:'#0EA5E9', d:'M3 16l1.6-5.6h14.8L21 16M3 16h18v3.5H3zM7 19.5v1M17 19.5v1' },
      { name:'Permutas', sub:'Cadastro e acompanhamento', c:'#7C3AED', d:'M3 8h14M13 4l4 4-4 4M21 16H7M11 12l-4 4 4 4' },
      { name:'Vendas', sub:'Propostas e contratos', c:'#F59E0B', d:'M3 17l5-5 4 3 8-9M15 6h5v5' },
      { name:'Cobrança', sub:'Carteira e inadimplência', c:'#EC4899', d:'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5' },
      { name:'Jurídico', sub:'Processos e distratos', c:'#43B997', d:'M12 4v16M7 20h10M5 9h14M5 9l2.5 6h-5zM19 9l2.5 6h-5z' },
      { name:'CRC', sub:'Relacionamento com cliente', c:'#4161FF', d:'M3 5h18v14H3zM8 9.9a2.1 2.1 0 100 4.2 2.1 2.1 0 000-4.2M13 10h6M13 14h4' },
      { name:'Configurações', sub:'Usuários, perfis, auditoria', c:'#94A3B8', d:'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8' },
    ],
    cadastros: [
      { name:'Financeiro', sub:'Despesas e categorias', c:'#4161FF', d:'M3 6h18v12H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5' },
      { name:'Clientes', sub:'Pessoas e empresas', c:'#43B997', d:'M12 5a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6' },
      { name:'Fornecedores', sub:'Parceiros e contratos', c:'#F59E0B', d:'M3 8h18v11H3zM8 8V6a4 4 0 018 0v2' },
      { name:'Imóveis', sub:'Unidades e lotes', c:'#7C3AED', d:'M4 10.5L12 4l8 6.5M6 9.5V20h12V9.5' },
      { name:'Contratos', sub:'Modelos e vigências', c:'#0EA5E9', d:'M5 3h14v18H5zM8.5 8h7M8.5 12h7M8.5 16h4' },
    ],
  };

  econIndicators = [
    { label: 'SELIC', full: 'Taxa Selic (Meta)', value: '15,00%' },
    { label: 'CDI', full: 'CDI (Taxa DI)', value: '14,90%' },
    { label: 'IPCA', full: 'IPCA (Mensal)', value: '0,31%' },
    { label: 'IGP-M', full: 'IGP-M (Mensal)', value: '0,18%' },
    { label: 'INCC-M', full: 'INCC-M (Mensal)', value: '0,42%' },
  ];

  bgSwatches = [
    { name:'Nocturne', v:'#161826' },
    { name:'Grafite', v:'#202024' },
    { name:'Azul profundo', v:'#0F1B3D' },
    { name:'Verde escuro', v:'#0E2A24' },
    { name:'Ardósia', v:'#2A2F3A' },
  ];

  componentDidMount() {
    setTimeout(() => this.setState({ chartMounted: true }), 60);
    try {
      const saved = JSON.parse(localStorage.getItem('he_home_bg') || 'null');
      if (saved && saved.bgMode) {
        const ok = this.bgSwatches.some(sw => sw.v === saved.bgColor);
        this.setState({
          bgMode: saved.bgMode === 'color' ? 'color' : 'image',
          bgColor: ok ? saved.bgColor : '#161826',
          bgUrl: saved.bgUrl || this.state.bgUrl,
        });
      }
    } catch { /* storage blocked */ }
    try {
      const savedEmp = JSON.parse(localStorage.getItem('he_prog_empresas_default') || 'null');
      if (Array.isArray(savedEmp)) this.setState({ pgEmpDefault: savedEmp, pgEmpSel: savedEmp });
    } catch { /* storage blocked */ }
    try {
      const savedFxEmp = JSON.parse(localStorage.getItem('he_fluxo_empresas_default') || 'null');
      if (Array.isArray(savedFxEmp)) this.setState({ fxEmpDefault: savedFxEmp, fxEmpSel: savedFxEmp });
    } catch { /* storage blocked */ }
    this.loadWeather();
    this.loadIndicators();
    if (this.live) {
      if (this.props.session) { this.loadCatalogs(); this.loadBg(); }
      this.setState({ lcRowsData: [], pgDateFrom: todayIso(), pgDateTo: todayIso(), sbDate: todayIso(), lcFrom: todayIso(), lcTo: addDays(todayIso(), 12) });
    }
  }

  componentDidUpdate() {
    this.ensureRanges();
    // Page the profile cannot open (menus are hidden, but a tile or old state may lead here).
    const need = this.pagePerm[this.state.page];
    if (this.live && this.state.view === 'app' && need && !this.pode(need)) {
      this.setState({ page: 'dashboard', module: 'Painel' });
      this.toast('Seu perfil não tem acesso a esta tela.');
    }
  }

  componentWillUnmount() {
    clearTimeout(this._toastT);
    cancelAnimationFrame(this._sbRaf);
  }

  /** True when Supabase is configured; false = demo mode on the prototype's sample data. */
  live = isLive;

  signOut() {
    if (supabase) supabase.auth.signOut();
  }

  // Banco Central SGS series (no key needed): SELIC meta e CDI em % a.a.; IPCA, IGP-M e
  // INCC-M em % no mês. Read through the app-indicadores edge function (server side, no
  // CORS); if it is unavailable, straight from api.bcb.gov.br. "—" if both fail.
  indicatorSeries: Record<string, number> = { SELIC: 432, CDI: 4389, IPCA: 433, 'IGP-M': 189, 'INCC-M': 7456 };

  async loadIndicators() {
    if (!this.live) return;
    const pct = (n: number | null | undefined) => (n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%');
    let values: Record<string, number | null> = {};
    try {
      if (!this.props.session) throw new Error('sem sessão');
      const { indicadores } = await apoioApi.indicadores();
      values = Object.fromEntries(Object.keys(this.indicatorSeries).map(k => [k, indicadores?.[k]?.valor ?? null]));
    } catch { /* fall back to the browser */ }
    const missing = Object.entries(this.indicatorSeries).filter(([k]) => values[k] == null);
    await Promise.all(missing.map(async ([label, code]) => {
      try {
        const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`);
        const [last] = await r.json();
        values[label] = parseFloat(String(last.valor).replace(',', '.'));
      } catch {
        values[label] = null;
      }
    }));
    this.setState({ econValues: Object.fromEntries(Object.keys(this.indicatorSeries).map(k => [k, pct(values[k])])) });
  }

  saveBg(patch) {
    this.setState(patch, () => {
      const s = this.state;
      // Custom images live in Storage (signed URL that expires); only the default URL is kept here.
      const own = s.bgUrl.startsWith('data:') || s.bgUrl.includes('/storage/v1/');
      try { localStorage.setItem('he_home_bg', JSON.stringify({ bgMode: s.bgMode, bgColor: s.bgColor, bgUrl: own ? '' : s.bgUrl })); } catch { /* storage blocked */ }
    });
  }

  static BG_DEFAULT = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2200&q=70';
  static BG_MAX_BYTES = 5 * 1024 * 1024;
  static BG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /** Loads the signed-in user's saved background from the private "app-fundos" bucket. */
  async loadBg() {
    const uid = this.props.session?.user?.id;
    if (!supabase || !uid) return;
    const { data } = await supabase.storage.from('app-fundos').createSignedUrl(`${uid}/fundo`, 7 * 24 * 3600);
    if (data?.signedUrl) this.setState({ bgUrl: data.signedUrl, bgCustom: true });
  }

  /** Deletes the user's uploaded background and goes back to the app's default image. */
  async restoreBg() {
    const uid = this.props.session?.user?.id;
    if (!window.confirm('Restaurar o fundo padrão? A sua imagem será apagada.')) return;
    if (supabase && uid) {
      const { error } = await supabase.storage.from('app-fundos').remove([`${uid}/fundo`]);
      if (error) return this.toast('Não foi possível restaurar o fundo: ' + error.message);
    }
    this.setState({ bgCustom: false });
    this.saveBg({ bgUrl: AppLogic.BG_DEFAULT, bgMode: 'image' });
    this.toast('Fundo padrão restaurado.');
  }

  /** Validates and uploads a background image (JPG/PNG/WebP, up to 5 MB) to the user's own folder. */
  async uploadBg(file: File) {
    if (!AppLogic.BG_TYPES.includes(file.type)) return this.toast('Formato não aceito. Use JPG, PNG ou WebP.');
    if (file.size > AppLogic.BG_MAX_BYTES) {
      return this.toast(`Imagem muito grande (${(file.size / 1048576).toFixed(1).replace('.', ',')} MB). O limite é 5 MB — o ideal é 1920×1080.`);
    }
    const dims = await new Promise<{ w: number; h: number } | null>(res => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(u); };
      img.onerror = () => { res(null); URL.revokeObjectURL(u); };
      img.src = u;
    });
    if (!dims) return this.toast('Não foi possível ler a imagem.');
    const small = dims.w < 1280 || dims.h < 720;

    const uid = this.props.session?.user?.id;
    if (!supabase || !uid) {
      // Demo mode: keep it in memory only.
      const r = new FileReader();
      r.onload = () => this.saveBg({ bgUrl: r.result, bgMode: 'image' });
      r.readAsDataURL(file);
      return;
    }
    const path = `${uid}/fundo`;
    const { error } = await supabase.storage.from('app-fundos').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (error) return this.toast('Não foi possível enviar a imagem: ' + error.message);
    const { data, error: e2 } = await supabase.storage.from('app-fundos').createSignedUrl(path, 7 * 24 * 3600);
    if (e2 || !data?.signedUrl) return this.toast('Imagem enviada, mas não foi possível exibi-la: ' + (e2?.message || ''));
    this.saveBg({ bgUrl: data.signedUrl + '&t=' + Date.now(), bgMode: 'image', bgCustom: true });
    this.toast(small ? `Fundo salvo, mas a imagem (${dims.w}×${dims.h}) é pequena e pode ficar borrada. O ideal é 1920×1080.` : 'Fundo salvo.');
  }

  kindFor(code, temp) {
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)) return { k:'rain', l:'Chuva' };
    if ([45,48,2,3].includes(code)) return { k:'cloud', l:'Nublado' };
    if (temp >= 30) return { k:'heat', l:'Calor' };
    return { k:'sun', l:'Sol' };
  }

  async loadWeather() {
    try {
      const g = await (await fetch('https://ipapi.co/json/')).json();
      const place = [g.city, g.region_code || g.region].filter(Boolean).join(', ');
      this.setState({ place: place || 'Sua região' });
      const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code&timezone=auto`)).json();
      const temp = Math.round(w.current.temperature_2m);
      const kind = this.kindFor(w.current.weather_code, temp);
      this.setState({ temp, wkind: kind.k, wlabel: kind.l });
    } catch {
      this.setState({ place: 'Sua região', temp: null, wkind: 'cloud', wlabel: '' });
    }
  }

  dueSentence(due: { count: number; next10: number }) {
    const n = ['nenhuma', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
    const word = (k: number) => (k <= 10 ? n[k] : String(k));
    const hoje = due.count === 0 ? 'Nenhuma parcela vence hoje' : `Há ${word(due.count)} ${due.count === 1 ? 'parcela vencendo' : 'parcelas vencendo'} hoje`;
    return `${hoje} e ${word(due.next10)} nos próximos dez dias — quitá-las antecipadamente mantém a curva de juros em queda.`;
  }

  /** Brand, signed-in user and last Sienge sync, bound into the generated screens. */
  identityVals() {
    const brand = { brandName: 'B2 Gestão e Operações', brandShort: 'B2 Gestão e Operações', brandInitials: 'B2' };
    const syncAt = this.state.dbSync ? new Date(this.state.dbSync) : null;
    const syncLabel = this.live
      ? (syncAt ? `Sienge sincronizado às ${syncAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${syncAt.toDateString() === new Date().toDateString() ? '' : ` de ${syncAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}` : 'Sincronização com o Sienge')
      : 'Sienge sincronizado às 08:19';
    const user = this.props.session?.user;
    if (!this.live || !user) {
      return { ...brand, syncLabel, userName: 'Camila Duarte Ribeiro', userFirstName: 'Camila', userInitials: 'CD', userRole: 'Analista Financeiro Sênior', signOut: () => this.signOut() };
    }
    const meta = user.user_metadata || {};
    const name = String(meta.full_name || meta.name || user.email?.split('@')[0] || 'Usuário');
    const parts = name.trim().split(/\s+/);
    return {
      ...brand,
      syncLabel,
      userName: name,
      userFirstName: parts[0],
      userInitials: ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase(),
      userRole: String(meta.role || meta.cargo || user.email || ''),
      signOut: () => this.signOut(),
    };
  }

  fmtBRL(v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); }

  niceCeil(v) {
    if (v <= 0) return 10;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const frac = v / exp;
    let niceFrac;
    if (frac <= 1) niceFrac = 1; else if (frac <= 2) niceFrac = 2; else if (frac <= 5) niceFrac = 5; else niceFrac = 10;
    return niceFrac * exp;
  }

  buildInsight(pdata, variant) {
    const totalIn = pdata.data.reduce((a, d) => a + d.in, 0);
    const totalOut = pdata.data.reduce((a, d) => a + d.out, 0);
    const saldo = totalIn - totalOut;
    const pct = totalOut > 0 ? Math.round((saldo / totalOut) * 100) : 0;
    const best = pdata.data.reduce((a, d) => d.in > a.in ? d : a, pdata.data[0]);
    const f = this.fmtBRL.bind(this);
    const variants = [
      `As entradas somaram ${f(totalIn)} contra ${f(totalOut)} em saídas — saldo positivo de ${f(saldo)} (${pct}% acima das saídas). "${best.x}" concentrou o maior volume de entradas do período.`,
      `Destaque para "${best.x}", com entradas de ${f(best.in)}. No acumulado, o caixa fica positivo em ${f(saldo)}, um respiro de ${pct}% sobre o total de saídas.`,
      `O período fecha com saldo de ${f(saldo)}. Mantendo o ritmo atual de entradas, a tendência é de folga contínua no caixa nos próximos ciclos.`,
    ];
    return variants[variant % variants.length];
  }

  loadCatalogs(): Promise<void> { return loadCatalogs.call(this); }
  rangeData(kind, from: string, to: string): any { return rangeData.call(this, kind, from, to); }
  neededRanges(): any[] { return neededRanges.call(this); }
  ensureRanges(): void { ensureRanges.call(this); }
  empresaById(): any { return empresaById.call(this); }
  empresaNome(id: number, fallback?: string): string { return empresaNome.call(this, id, fallback); }
  readSaldos(): any { return readSaldos.call(this); }
  writeSaldos(date: string, patch: any): Promise<boolean> { return writeSaldos.call(this, date, patch); }
  saldoPorEmpresa(date: string): Record<number, number> { return saldoPorEmpresa.call(this, date); }
  loadLanc(): Promise<void> { return loadLanc.call(this); }
  loadFxSemRec(): Promise<void> { return loadFxSemRec.call(this); }

  usersVals(subItemStyle: string): any { return usersVals.call(this, subItemStyle); }
  deptsVals(): any { return deptsVals.call(this); }
  perfisVals(subItemStyle: string): any { return perfisVals.call(this, subItemStyle); }
  saldosVals(subItemStyle: string): any { return saldosVals.call(this, subItemStyle); }
  lancVals(subItemStyle: string): any { return lancVals.call(this, subItemStyle); }
  progVals(subItemStyle: string): any { return progVals.call(this, subItemStyle); }
  fluxoVals(subItemStyle: string): any { return fluxoVals.call(this, subItemStyle); }
  renderVals(): any { return renderVals.call(this); }
}
