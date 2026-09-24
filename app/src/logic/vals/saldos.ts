import type { AppLogic } from '../AppLogic';
import { todayIso } from '../../lib/api';
import { sbLive, downloadTemplate, importCsv } from '../saldosLive';

export function saldosVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const defDate = this.live ? todayIso() : '2026-09-23';
  const all = this.live ? sbLive(this, s.sbDate || defDate) : (s.sbAccounts || this.sbSeed());
  const f2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const empAll = 'Todas as empresas', bankAll = 'Todos os bancos', stAll = 'Todos os status';
  const sbEmp = s.sbEmp || empAll, sbBank = s.sbBank || bankAll, sbStatus = s.sbStatus || stAll;
  const stKey = { 'Atualizado': 'ok', 'Sem saldo do dia': 'missing', 'Divergente do extrato': 'div' };
  const q = (s.sbSearch || '').trim().toLowerCase();
  const filtered = all.filter(a =>
    (sbEmp === empAll || a.emp === sbEmp) &&
    (sbBank === bankAll || a.bank === sbBank) &&
    (sbStatus === stAll || a.status === stKey[sbStatus]) &&
    (!q || `${a.cd} ${a.emp} ${a.bank} ${a.ag} ${a.cc}`.toLowerCase().includes(q)));

  const empNames: any[] = []; all.forEach(a => { if (empNames.indexOf(a.emp) < 0) empNames.push(a.emp); });
  const total = all.reduce((t, a) => t + (a.saldo || 0), 0);
  const byEmp: any = {}; all.forEach(a => { byEmp[a.emp] = (byEmp[a.emp] || 0) + (a.saldo || 0); });
  const top = Object.keys(byEmp).sort((x, y) => byEmp[y] - byEmp[x])[0];
  const missing = all.filter(a => a.status === 'missing');
  const okCount = all.length - missing.length;
  const t = s.sbT == null ? 1 : s.sbT;
  const ease = 1 - Math.pow(1 - t, 3);
  const short = n => (n.split('–')[1] || n).trim();
  const bankShort = b => b === 'Banco do Brasil' ? 'BB' : b;

  const [yy, mm, dd] = (s.sbDate || defDate).split('-');
  const dLabel = `${dd}/${mm}`;

  const statusMeta = {
    ok: { label: 'Atualizado', color: '#258B6C', bg: '#E1F7EF', dot: '#43B997' },
    missing: { label: 'Sem saldo do dia', color: '#B45309', bg: '#FFF0DD', dot: '#F59E0B' },
    div: { label: 'Divergente do extrato', color: '#DC2626', bg: '#FEE9E9', dot: '#EF4444' },
  };
  const cols = 'display:grid;grid-template-columns:60px minmax(250px,1fr) 118px 160px 104px 176px 68px;gap:12px;align-items:center';
  const actBtn = 'width:27px;height:27px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,color .15s';
  const grouped = s.sbGroup === 'empresa';

  const openFor = a => this.setState({ sbModal: true, sbErr: '', ddOpen: null, sbForm: { id: a ? a.id : null, date: s.sbDate || defDate, value: a && a.saldo != null ? f2(a.saldo) : '', origem: (a && a.origem) || 'Manual', obs: (a && a.obs) || '' } });

  let idx = 0;
  const mkAcct = a => {
    const meta = statusMeta[a.status];
    const bk = this.live ? { c: a.bankColor, s: a.bankShort } : this.sbBanks[a.bank];
    const i = idx++;
    const syncing = s.sbSyncing === a.id;
    const tint = a.status === 'missing' ? '#FFFBF3' : (a.status === 'div' ? '#FFFAFA' : '#FFFFFF');
    return {
      isAcct: true, isGroup: false,
      cdLabel: a.cd, emp: a.emp,
      sub: `${a.bank} · Ag ${a.ag} · C/C ${a.cc}`,
      bankShort: bk.s,
      bankStyle: `width:30px;height:30px;flex:none;border-radius:8px;background:${bk.c}14;border:1px solid ${bk.c}33;color:${bk.c};display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;letter-spacing:.02em`,
      uso: a.uso.map(u => ({ label: u, style: `font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;${u === 'Pag.' ? 'background:#EAF1FF;color:#2445E8' : 'background:#E1F7EF;color:#258B6C'}` })),
      usoEmptyStyle: `display:${a.uso.length ? 'none' : 'inline'};font-size:13px;color:#CBD5E1`,
      hasSaldo: a.saldo != null, missing: a.saldo == null,
      saldoFmt: a.saldo != null ? f2(a.saldo) : '',
      saldoStyle: `font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:${a.status === 'div' ? '#DC2626' : '#111827'}`,
      upd: a.upd,
      statusLabel: meta.label,
      statusStyle: `display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:${meta.color};background:${meta.bg};border-radius:20px;padding:3px 9px 3px 8px;white-space:nowrap`,
      dotStyle: `width:6px;height:6px;border-radius:50%;background:${meta.dot};${a.status === 'ok' ? '' : 'animation:blink 1.4s ease-in-out infinite'}`,
      rowStyle: `${cols};padding:10px 18px${grouped ? ' 10px 30px' : ''};background:${tint};box-shadow:inset 0 -1px 0 #F4F4F6;transition:background .15s;animation:rowIn .35s ease-out both;animation-delay:${Math.min(i, 16) * 22}ms`,
      hoverStyle: `background:${a.status === 'missing' ? '#FFF7EB' : '#FAFAFB'}`,
      actStyle: actBtn,
      syncIconStyle: syncing ? 'animation:spin .7s linear infinite' : '',
      inform: () => openFor(a),
      edit: () => openFor(a),
      sync: () => {
        if (this.live) { this.toast('Integração de saldo via API ainda não configurada — informe o saldo manualmente ou pela planilha-modelo.'); return; }
        if (a.status === 'missing') { this.toast('Conta sem integração via API — informe o saldo manualmente ou por planilha.'); return; }
        this.setState({ sbSyncing: a.id });
        setTimeout(() => {
          this.setSb(list => list.map(x => x.id === a.id ? Object.assign({}, x, { status: 'ok', upd: this.nowStamp() }) : x));
          this.setState({ sbSyncing: null });
          this.toast(`${short(a.emp)} (${bankShort(a.bank)}) sincronizada com o Sienge.`);
        }, 900);
      },
    };
  };

  let sbRows: any[] = [];
  if (grouped) {
    const order: any[] = []; filtered.forEach(a => { if (order.indexOf(a.emp) < 0) order.push(a.emp); });
    order.forEach(emp => {
      const accs = filtered.filter(a => a.emp === emp);
      const pend = accs.filter(a => a.status !== 'ok').length;
      const i = idx++;
      sbRows.push({
        isGroup: true, isAcct: false, cd: accs[0].cd, emp,
        countLabel: accs.length === 1 ? '1 conta' : `${accs.length} contas`,
        subtotal: f2(accs.reduce((t2, a) => t2 + (a.saldo || 0), 0)),
        pendLabel: pend ? (pend === 1 ? '1 pendência' : `${pend} pendências`) : '',
        pendStyle: `display:${pend ? 'inline-flex' : 'none'};font-size:11px;font-weight:600;color:#B45309;background:#FFF0DD;border-radius:20px;padding:2px 8px`,
        rowStyle: `${cols};padding:9px 18px;background:#F7F8FF;box-shadow:inset 0 -1px 0 #EEEEF1,inset 3px 0 0 #4161FF;animation:rowIn .35s ease-out both;animation-delay:${Math.min(i, 16) * 22}ms`,
      });
      accs.forEach(a => sbRows.push(mkAcct(a)));
    });
  } else {
    sbRows = filtered.map(mkAcct);
  }

  const acctLabel = a => `${a.cd} · ${a.emp} · ${bankShort(a.bank)} ${a.cc}`;
  const form = s.sbForm || { id: null, date: s.sbDate || defDate, value: '', origem: 'Manual', obs: '' };
  const formAcct = all.find(a => a.id === form.id);
  const ddSbEmp = this.mkDropdown('sbEmp', s, sbEmp, [empAll].concat(empNames), v => this.setState({ sbEmp: v }));
  const ddSbBank = this.mkDropdown('sbBank', s, sbBank, [bankAll].concat(this.live ? Array.from(new Set<string>(all.map(a => a.bank))).sort() : Object.keys(this.sbBanks)), v => this.setState({ sbBank: v }));
  const ddSbStatus = this.mkDropdown('sbStatus', s, sbStatus, [stAll].concat(Object.keys(stKey)), v => this.setState({ sbStatus: v }));
  const ddSbConta = this.mkDropdown('sbConta', s, formAcct ? acctLabel(formAcct) : 'Selecione a conta', all.map(acctLabel), v => {
    const a = all.find(x => acctLabel(x) === v);
    this.setState(st => ({ sbForm: Object.assign({}, st.sbForm, { id: a.id, value: a.saldo != null ? f2(a.saldo) : '' }), sbErr: '' }));
  });
  ddSbConta.panelStyle = ddSbConta.panelStyle.replace('max-width:260px', 'max-width:none').replace('width:max-content', 'width:100%');
  const patch = p => this.setState(st => ({ sbForm: Object.assign({}, st.sbForm, p) }));
  const parseBRL = v => { const n = parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };
  const hasFilters = q || sbEmp !== empAll || sbBank !== bankAll || sbStatus !== stAll;
  const seg = on => `border:none;border-radius:6px;padding:0 12px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${on ? '#111827' : 'transparent'};color:${on ? '#FFFFFF' : '#64748B'}`;
  const cardBase = 'display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:10px;background:#FFFFFF;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:200ms;transition:transform .2s ease,box-shadow .2s ease;cursor:pointer';

  return {
    isSaldos: s.page === 'saldos',
    goSaldos: e => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'saldos', module: 'Financeiro', financeiroOpen: true, userMenuOpen: false }); this.startSbAnim(); },
    saldosItemStyle: s.page === 'saldos' ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997' : subItemStyle,
    finStub: e => { if (e && e.preventDefault) e.preventDefault(); this.toast('Tela em construção.'); },

    sbSyncLabel: this.identityVals().syncLabel,
    sbTotalFmt: 'R$ ' + f2(total * ease),
    sbTotalSub: `${all.length} contas · ${empNames.length} empresas`,
    sbAcctCount: all.length,
    sbEmpCountLabel: `${empNames.length} empresas cadastradas`,
    sbCoverageBar: `height:100%;border-radius:4px;background:linear-gradient(to right,#43B997,#35AD88);width:${all.length ? (okCount / all.length) * 100 * ease : 0}%;transition:width .5s cubic-bezier(.16,1,.3,1)`,
    sbCoverageLabel: `${okCount} de ${all.length} com saldo do dia`,
    sbTopEmp: top && byEmp[top] ? top : '—',
    sbTopEmpSub: 'R$ ' + f2(byEmp[top] || 0),
    sbMissingCount: missing.length,
    sbMissingSub: missing.length ? missing.slice(0, 12).map(a => `${short(a.emp)} (${bankShort(a.bank)})`).join(' · ') : 'Todas as contas estão atualizadas',
    sbMissingCardStyle: cardBase + `;box-shadow:0 0 0 1px ${sbStatus === 'Sem saldo do dia' ? '#F59E0B' : '#EEEEF1'},0 1px 2px rgba(0,0,0,.03)`,
    sbFilterMissing: () => this.setState({ sbStatus: sbStatus === 'Sem saldo do dia' ? stAll : 'Sem saldo do dia' }),

    sbDate: s.sbDate || defDate,
    onSbDate: e => { this.setState({ sbDate: e.target.value || defDate }); this.startSbAnim(); },
    sbSearch: s.sbSearch || '',
    onSbSearch: e => this.setState({ sbSearch: e.target.value }),
    ddSbEmp, ddSbBank, ddSbStatus, ddSbConta,
    // Fluxo's filter bar is its own stacking context (z-index:10): keep the overlay below it so the checkbox list stays clickable.
    finPageOverlayStyle: `display:${s.ddOpen && !s.sbModal && !s.lcModal && !['fxEmp', 'fxRec'].includes(s.ddOpen) ? 'block' : (s.ddOpen && ['fxEmp', 'fxRec'].includes(s.ddOpen) ? 'block' : 'none')};position:fixed;inset:0;z-index:${['fxEmp', 'fxRec'].includes(s.ddOpen) ? 9 : 75};background:transparent`,
    sbGroupTabs: [['conta', 'Conta'], ['empresa', 'Empresa']].map(([k, l]) => ({
      label: l, style: seg((s.sbGroup || 'conta') === k), onClick: () => this.setState({ sbGroup: k }),
    })),
    sbClearStyle: `display:${hasFilters ? 'inline-flex' : 'none'};align-items:center;height:36px;padding:0 13px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;animation:popIn .18s ease-out both`,
    sbClearFilters: () => this.setState({ sbSearch: '', sbEmp: empAll, sbBank: bankAll, sbStatus: stAll }),

    sbSaldoHeader: `Saldo inicial ${dLabel}`,
    sbRows,
    sbEmptyStyle: `display:${filtered.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:48px 20px`,
    sbFooterLabel: `${filtered.length} de ${all.length} contas`,
    sbFilteredTotal: 'R$ ' + f2(filtered.reduce((t2, a) => t2 + (a.saldo || 0), 0)),

    sbImportLabel: s.sbImporting ? 'Importando…' : 'Importar planilha',
    sbDownload: () => (this.live ? downloadTemplate(this, all, s.sbDate || defDate) : this.toast('Planilha-modelo baixada · saldos_modelo.xlsx')),
    sbImport: e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      e.target.value = '';
      if (this.live) {
        if (!this.podeEditar('financeiro.saldos')) return;
        this.setState({ sbImporting: true });
        importCsv(this, file, all, s.sbDate || defDate).finally(() => { this.setState({ sbImporting: false }); this.startSbAnim(); });
        return;
      }
      this.setState({ sbImporting: true });
      setTimeout(() => {
        const n = (s.sbAccounts || this.sbSeed()).filter(a => a.status === 'missing').length;
        this.setSb(list => list.map((a, i) => a.status === 'missing' ? Object.assign({}, a, { saldo: 12480.35 + i * 3170.2, status: 'ok', upd: this.nowStamp() }) : a));
        this.setState({ sbImporting: false });
        this.toast(`${file.name} importada · ${n} ${n === 1 ? 'conta atualizada' : 'contas atualizadas'}.`);
      }, 1100);
    },

    sbOverlayStyle: `display:${s.sbModal ? 'flex' : 'none'};position:fixed;inset:0;z-index:90;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both`,
    sbOpenNew: () => openFor(missing[0] || null),
    sbClose: () => this.setState({ sbModal: false, sbForm: null, sbErr: '', ddOpen: null }),
    sbModalTitle: formAcct ? `Informar saldo · ${short(formAcct.emp)}` : 'Informar saldo',
    sbFDate: form.date,
    onSbFDate: e => patch({ date: e.target.value }),
    sbFValue: form.value,
    onSbFValue: e => patch({ value: e.target.value.replace(/[^\d,.-]/g, '') }),
    sbFValueStyle: `width:100%;height:38px;padding:0 12px 0 36px;border-radius:8px;background:#FFFFFF;font-size:14px;font-weight:600;font-family:inherit;color:#111827;font-variant-numeric:tabular-nums;text-align:right;transition:border-color .15s,box-shadow .15s;border:1px solid ${s.sbErr && parseBRL(form.value) == null ? '#FCA5A5' : '#E7E7EA'}`,
    sbFObs: form.obs,
    onSbFObs: e => patch({ obs: e.target.value }),
    sbOrigemTabs: ['Manual', 'Extrato bancário'].map(l => ({ label: l, style: seg(form.origem === l), onClick: () => patch({ origem: l }) })),
    sbErr: s.sbErr || '',
    sbErrStyle: `display:${s.sbErr ? 'flex' : 'none'};align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#FEE9E9;border:1px solid #FCA5A5;color:#DC2626;font-size:12.5px;animation:popIn .18s ease-out both`,
    sbSave: async () => {
      const v = parseBRL(form.value);
      if (!formAcct || v == null) { this.setState({ sbErr: !formAcct ? 'Selecione a conta corrente.' : 'Informe um valor de saldo válido.' }); return; }
      if (this.live) {
        if (!this.pode('financeiro.saldos', true)) { this.setState({ sbErr: 'Seu perfil não tem permissão para informar saldos.' }); return; }
        if (s.sbSaving) return;
        this.setState({ sbSaving: true });
        const ok = await this.writeSaldos(form.date || s.sbDate || defDate, { [formAcct.id]: { saldo: v, upd: this.nowStamp(), origem: form.origem, obs: form.obs } });
        this.setState({ sbSaving: false });
        if (!ok) return;
      } else this.setSb(list => list.map(a => a.id === formAcct.id ? Object.assign({}, a, { saldo: v, status: 'ok', upd: this.nowStamp() }) : a));
      this.setState({ sbModal: false, sbForm: null, sbErr: '' });
      this.startSbAnim();
      this.toast(`Saldo de ${short(formAcct.emp)} (${bankShort(formAcct.bank)}) salvo · R$ ${f2(v)}.`);
    },
  };
}
