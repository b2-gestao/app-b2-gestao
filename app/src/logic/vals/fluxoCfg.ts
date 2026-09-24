import type { AppLogic } from '../AppLogic';
import { cadastrosApi } from '../../lib/api';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Gear modal of the Fluxo de caixa: empresas whose parcelas a receber are ignored
 * (app_fluxo_empresas_sem_receber). Edits a draft; "Salvar" writes the whole list.
 */
export function fluxoCfgVals(this: AppLogic) {
  const s: any = this.state;
  const perm = 'financeiro.fluxo';
  const catalog: { cd: number; name: string }[] = this.live
    ? Object.values(this.empresaById()).map((e: any) => ({ cd: Number(e.id), name: e.label })).sort((a, b) => a.cd - b.cd)
    : this.fxSeed().map(e => ({ cd: e.cd, name: e.name }));
  const nameOf = (cd: number) => catalog.find(e => e.cd === cd)?.name || `Empresa ${cd}`;

  const draft: { cd: number; motivo: string }[] = s.fxCfgDraft || s.fxSemRec || [];
  const setDraft = (list: { cd: number; motivo: string }[]) => this.setState({ fxCfgDraft: list, fxCfgErr: '' });
  const inDraft = new Set(draft.map(d => d.cd));

  const q = norm((s.fxCfgQuery || '').trim());
  const qCode = q.replace(/\D/g, '');
  const results = s.fxCfgPick != null || !q ? [] : catalog
    .filter(e => !inDraft.has(e.cd) && ((qCode && String(e.cd).includes(qCode)) || norm(e.name).includes(q)))
    .sort((a, b) => (String(b.cd) === qCode ? 1 : 0) - (String(a.cd) === qCode ? 1 : 0) || a.cd - b.cd)
    .slice(0, 8);

  const reset = { fxCfgQuery: '', fxCfgPick: null, fxCfgMotivo: '', fxCfgErr: '' };
  const close = () => this.setState({ fxCfgOpen: false, fxCfgDraft: null, fxCfgSaving: false, ...reset });

  const add = () => {
    if (s.fxCfgPick == null) { this.setState({ fxCfgErr: 'Selecione uma empresa pela pesquisa (código ou nome).' }); return; }
    if (!(s.fxCfgMotivo || '').trim()) { this.setState({ fxCfgErr: 'Informe o motivo de não considerar os recebíveis.' }); return; }
    this.setState({ fxCfgDraft: draft.concat({ cd: s.fxCfgPick, motivo: s.fxCfgMotivo.trim() }), ...reset });
  };

  const save = () => {
    if (s.fxCfgSaving) return;
    const semMotivo = draft.find(d => !d.motivo.trim());
    if (semMotivo) { this.setState({ fxCfgErr: `Informe o motivo da empresa ${semMotivo.cd}.` }); return; }
    const rows = draft.map(d => ({ cd: d.cd, motivo: d.motivo.trim() }));
    const okMsg = rows.length
      ? `Configuração salva · ${rows.length} empresa${rows.length > 1 ? 's' : ''} sem recebíveis no fluxo.`
      : 'Configuração salva · todas as empresas consideram os recebíveis.';
    if (!this.live) { this.setState({ fxSemRec: rows }); close(); this.toast(okMsg); return; }
    if (!this.pode(perm, true)) { this.setState({ fxCfgErr: 'Seu perfil não tem permissão para alterar o fluxo de caixa.' }); return; }
    const remover = (s.fxSemRec || []).map(x => x.cd).filter(cd => !rows.some(r => r.cd === cd));
    this.setState({ fxCfgSaving: true });
    this.cadastroAcao(
      () => cadastrosApi.salvarFluxoSemReceber(rows.map(r => ({ company_id: r.cd, motivo: r.motivo })), remover),
      okMsg, () => this.loadFxSemRec(), m => this.setState({ fxCfgErr: m, fxCfgSaving: false }),
    ).then(ok => ok && close());
  };

  const inputStyle = (err: boolean) => `height:38px;width:100%;box-sizing:border-box;padding:0 12px;border-radius:8px;border:1px solid ${err ? '#FCA5A5' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s`;
  const errPick = !!s.fxCfgErr && s.fxCfgPick == null && !!s.fxCfgErr.startsWith('Selecione');
  const errMotivo = !!s.fxCfgErr && s.fxCfgErr.startsWith('Informe o motivo de');

  return {
    fxCfgOpen: !!s.fxCfgOpen,
    openFxCfg: () => this.setState({ fxCfgOpen: true, fxCfgDraft: (s.fxSemRec || []).map(x => ({ ...x })), fxCfgSaving: false, ddOpen: null, ...reset }),
    closeFxCfg: close,
    fxCfgCountLabel: draft.length
      ? `${draft.length} empresa${draft.length > 1 ? 's' : ''} sem recebíveis no fluxo`
      : 'Nenhuma empresa configurada',
    fxCfgQuery: s.fxCfgQuery || '',
    onFxCfgQuery: e => this.setState({ fxCfgQuery: e.target.value, fxCfgPick: null, fxCfgErr: '' }),
    fxCfgQueryStyle: inputStyle(errPick),
    fxCfgResults: results.map(e => ({
      cd: e.cd, name: e.name,
      onClick: () => this.setState({ fxCfgPick: e.cd, fxCfgQuery: `${e.cd} · ${e.name}`, fxCfgErr: '' }),
    })),
    fxCfgNoResults: !!q && s.fxCfgPick == null && results.length === 0,
    fxCfgMotivo: s.fxCfgMotivo || '',
    onFxCfgMotivo: e => this.setState({ fxCfgMotivo: e.target.value, fxCfgErr: '' }),
    onFxCfgMotivoKey: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
    fxCfgMotivoStyle: inputStyle(errMotivo),
    addFxCfg: add,
    fxCfgRows: draft.map(d => ({
      cd: d.cd,
      name: nameOf(d.cd),
      motivo: d.motivo,
      motivoStyle: inputStyle(!!s.fxCfgErr && !d.motivo.trim()),
      onMotivo: e => setDraft(draft.map(x => (x.cd === d.cd ? { ...x, motivo: e.target.value } : x))),
      remove: () => setDraft(draft.filter(x => x.cd !== d.cd)),
    })),
    fxCfgErr: s.fxCfgErr || '',
    saveFxCfg: save,
    fxCfgSaveLabel: s.fxCfgSaving ? 'Salvando…' : 'Salvar',
    fxCfgSaving: !!s.fxCfgSaving,
  };
}
