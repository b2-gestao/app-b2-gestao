import type { AppLogic } from '../AppLogic';
import { cadastrosApi, type BiPainel } from '../../lib/api';

/**
 * Link typed in the painel form: the Power BI "Publicar na Web" link, or the whole
 * <iframe> HTML it offers (the src is taken). Returns the https URL, or '' if invalid.
 */
export function biUrl(raw: string): string {
  const t = (raw || '').trim();
  const m = t.match(/src\s*=\s*["']([^"']+)["']/i);
  try {
    const u = new URL((m ? m[1] : t).replace(/&amp;/g, '&'));
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

type Draft = { key: string; id?: string; nome: string; url: string; ativo: boolean; ocultar_rodape: boolean };

/**
 * BI section: one sidebar item per painel (app_bi_paineis), the page with the report in an
 * iframe, and the "Gerenciar painéis" modal. Who sees a painel: bi.<id> (view) in the profile;
 * bi.gerenciar (edit) manages the list and sees every painel.
 */
export function biVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const all: BiPainel[] = s.biPaineis || [];
  const gerenciar = this.pode('bi.gerenciar', true);
  const visiveis = all.filter(p => p.ativo && (gerenciar || this.pode('bi.' + p.id)));
  const painel = visiveis.find(p => p.id === s.biId) || visiveis[0] || null;
  const frameKey = painel ? `${painel.id}:${s.biReload || 0}` : '';

  const open = (p: BiPainel) => this.setState({ view: 'app', page: 'bi', module: 'BI', biOpen: true, biId: p.id, biLoadedKey: null, userMenuOpen: false });

  // ---- modal "Gerenciar painéis" (edits a draft; "Salvar" writes the whole list) ----
  const draft: Draft[] = s.biCfgDraft || [];
  const setDraft = (list: Draft[]) => this.setState({ biCfgDraft: list, biCfgErr: '' });
  const patchRow = (key: string, patch: Partial<Draft>) => setDraft(draft.map(d => (d.key === key ? { ...d, ...patch } : d)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= draft.length) return;
    const list = draft.slice();
    [list[i], list[j]] = [list[j], list[i]];
    setDraft(list);
  };
  const reset = { biCfgNome: '', biCfgUrl: '', biCfgErr: '' };
  const close = () => this.setState({ biCfgOpen: false, biCfgDraft: null, biCfgSaving: false, ...reset });
  const openCfg = () => this.setState({
    biCfgOpen: true, biCfgSaving: false, userMenuOpen: false, ...reset,
    biCfgDraft: all.map(p => ({ key: p.id, id: p.id, nome: p.nome, url: p.url, ativo: p.ativo, ocultar_rodape: p.ocultar_rodape })),
  });

  const add = () => {
    const nome = (s.biCfgNome || '').trim();
    const url = biUrl(s.biCfgUrl);
    if (!nome) { this.setState({ biCfgErr: 'Informe o nome do painel.' }); return; }
    if (!url) { this.setState({ biCfgErr: 'Informe o link público do Power BI (começa com https://).' }); return; }
    this.setState({ biCfgDraft: draft.concat({ key: 'n' + Date.now(), nome, url, ativo: true, ocultar_rodape: true }), ...reset });
  };

  const save = () => {
    if (s.biCfgSaving) return;
    const semNome = draft.find(d => !d.nome.trim());
    if (semNome) { this.setState({ biCfgErr: 'Todos os painéis precisam de um nome.' }); return; }
    const semUrl = draft.find(d => !biUrl(d.url));
    if (semUrl) { this.setState({ biCfgErr: `O link do painel "${semUrl.nome.trim()}" é inválido (precisa começar com https://).` }); return; }
    const rows = draft.map((d, i) => ({ id: d.id, nome: d.nome.trim(), url: biUrl(d.url), ordem: i + 1, ativo: d.ativo, ocultar_rodape: d.ocultar_rodape }));
    const okMsg = `Painéis salvos · ${rows.length} ${rows.length === 1 ? 'painel cadastrado' : 'painéis cadastrados'}.`;
    if (!this.live) {
      this.setState({ biPaineis: rows.map((r, i) => ({ ...r, id: r.id || draft[i].key })) });
      close();
      this.toast(okMsg);
      return;
    }
    if (!gerenciar) { this.setState({ biCfgErr: 'Seu perfil não tem permissão para gerenciar os painéis de BI.' }); return; }
    const remover = all.map(p => p.id).filter(id => !rows.some(r => r.id === id));
    this.setState({ biCfgSaving: true });
    this.cadastroAcao(
      () => cadastrosApi.salvarBiPaineis(rows, remover),
      okMsg, () => this.loadBi(), m => this.setState({ biCfgErr: m, biCfgSaving: false }),
    ).then(ok => ok && close());
  };

  const inputStyle = (err: boolean) => `height:38px;width:100%;box-sizing:border-box;padding:0 12px;border-radius:8px;border:1px solid ${err ? '#FCA5A5' : '#E7E7EA'};background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s`;
  const err = s.biCfgErr || '';
  const switchStyle = (on: boolean) => ({
    track: `width:32px;height:18px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${on ? '#43B997' : '#D8D8E0'}`,
    knob: `position:absolute;top:2.5px;left:${on ? '16.5px' : '2.5px'};width:13px;height:13px;border-radius:50%;background:#FFFFFF;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.18)`,
  });

  const activeItem = ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997';

  return {
    // ---- sidebar ----
    biGroupStyle: visiveis.length || gerenciar ? '' : 'display:none',
    toggleBi: () => this.setState(st => ({ biOpen: !st.biOpen })),
    biChevron: (!s.collapsed && s.biOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    biContentStyle: `display:grid;grid-template-rows:${(!s.collapsed && s.biOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    biItems: visiveis.map(p => ({
      id: p.id,
      nome: p.nome,
      onClick: e => { if (e && e.preventDefault) e.preventDefault(); open(p); },
      style: s.page === 'bi' && painel?.id === p.id ? subItemStyle + activeItem : subItemStyle,
    })),
    biMenuEmpty: visiveis.length === 0,
    canManageBi: gerenciar,
    biManageItemStyle: subItemStyle + ';display:flex;align-items:center;gap:6px;color:#71717a',
    openBiCfgMenu: e => { if (e && e.preventDefault) e.preventDefault(); openCfg(); },
    biTileVisible: visiveis.length > 0 || gerenciar,
    openFirstBi: () => {
      this.setState({ view: 'app', page: 'bi', module: 'BI', biOpen: true, collapsed: false });
      if (visiveis[0]) open(visiveis[0]);
    },

    // ---- página ----
    isBi: s.page === 'bi',
    biTitle: painel ? painel.nome : 'Painéis de BI',
    biPainel: painel,
    biFrameKey: frameKey,
    biLoaded: !!frameKey && s.biLoadedKey === frameKey,
    onBiLoad: () => this.setState({ biLoadedKey: frameKey }),
    reloadBi: () => this.setState(st => ({ biReload: (st.biReload || 0) + 1 })),
    openBiNewTab: () => { if (painel) window.open(painel.url, '_blank', 'noopener,noreferrer'); },
    biCountLabel: `${visiveis.length} ${visiveis.length === 1 ? 'painel disponível' : 'painéis disponíveis'}`,
    openBiCfg: openCfg,

    // ---- modal ----
    biCfgOpen: !!s.biCfgOpen,
    closeBiCfg: close,
    biCfgCountLabel: draft.length ? `${draft.length} ${draft.length === 1 ? 'painel' : 'painéis'} · a ordem abaixo é a do menu` : 'Nenhum painel cadastrado',
    biCfgNome: s.biCfgNome || '',
    onBiCfgNome: e => this.setState({ biCfgNome: e.target.value, biCfgErr: '' }),
    biCfgNomeStyle: inputStyle(err.startsWith('Informe o nome')),
    biCfgUrl: s.biCfgUrl || '',
    onBiCfgUrl: e => this.setState({ biCfgUrl: e.target.value, biCfgErr: '' }),
    onBiCfgKey: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
    biCfgUrlStyle: inputStyle(err.startsWith('Informe o link')),
    addBiCfg: add,
    biCfgRows: draft.map((d, i) => {
      const sw = switchStyle(d.ativo);
      const swR = switchStyle(d.ocultar_rodape);
      return {
        key: d.key,
        nome: d.nome,
        url: d.url,
        isNew: !d.id,
        nomeStyle: inputStyle(!!err && !d.nome.trim()) + ';height:34px;font-weight:600',
        urlStyle: inputStyle(!!err && !biUrl(d.url)) + ';height:32px;font-size:12px;color:#64748B',
        onNome: e => patchRow(d.key, { nome: e.target.value }),
        onUrl: e => patchRow(d.key, { url: e.target.value }),
        ativo: d.ativo, ocultarRodape: d.ocultar_rodape,
        ativoLabel: d.ativo ? 'Ativo' : 'Inativo',
        ativoTrackStyle: sw.track, ativoKnobStyle: sw.knob,
        toggleAtivo: () => patchRow(d.key, { ativo: !d.ativo }),
        rodapeTrackStyle: swR.track, rodapeKnobStyle: swR.knob,
        toggleRodape: () => patchRow(d.key, { ocultar_rodape: !d.ocultar_rodape }),
        canUp: i > 0, canDown: i < draft.length - 1,
        up: () => move(i, -1), down: () => move(i, 1),
        remove: () => setDraft(draft.filter(x => x.key !== d.key)),
        rowStyle: `display:flex;flex-direction:column;gap:8px;padding:12px;box-shadow:${i ? 'inset 0 1px 0 #F4F4F6' : 'none'};opacity:${d.ativo ? 1 : .62};transition:opacity .2s`,
      };
    }),
    biCfgErr: err,
    saveBiCfg: save,
    biCfgSaveLabel: s.biCfgSaving ? 'Salvando…' : 'Salvar',
    biCfgSaving: !!s.biCfgSaving,
  };
}
