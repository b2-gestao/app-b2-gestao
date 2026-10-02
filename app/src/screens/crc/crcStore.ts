// CRC › Entregas: ponte entre a lógica do HTML (entregas.legacy.js, que trabalha sobre um objeto
// `db` em memória, como antes) e o Supabase.
//
// - carregar(): app_crc_carregar() → monta o `db` no formato do HTML.
// - save(db): o HTML chama save() a cada alteração. Aqui as linhas de cada tabela são recalculadas
//   a partir do `db` e comparadas com a última versão gravada; só o que mudou vai para o banco
//   (upsert) e o que sumiu é excluído. Se a gravação falhar, o `db` volta ao que está no banco.
// - Anexos: o HTML guarda o arquivo em base64 (att.data); antes de gravar a linha o arquivo sobe
//   para o bucket app-crc-entregas e o anexo passa a ter att.path.
// - IA: edge function app-ia (tela "crc"), com a chave do servidor.
import { supabase } from '../../lib/supabase';
import { invoke } from '../../lib/api';

type Row = Record<string, any>;
type Tabela =
  | 'app_crc_areas' | 'app_crc_modelos' | 'app_crc_projetos' | 'app_crc_blocos' | 'app_crc_acoes'
  | 'app_crc_acao_historico' | 'app_crc_anexos' | 'app_crc_obra_historico' | 'app_crc_decisoes';
type Linhas = Record<Tabela, Map<string, Row>>;

/** Pais antes dos filhos (upsert); a exclusão usa a ordem inversa. */
const ORDEM: Tabela[] = [
  'app_crc_areas', 'app_crc_modelos', 'app_crc_projetos', 'app_crc_blocos', 'app_crc_acoes',
  'app_crc_acao_historico', 'app_crc_anexos', 'app_crc_obra_historico', 'app_crc_decisoes',
];
const CHAVE: Partial<Record<Tabela, string>> = { app_crc_areas: 'nome' };
const BUCKET = 'app-crc-entregas';
const STATUS = ['NÃO INICIADO', 'EM ANDAMENTO', 'CONCLUÍDO', 'NÃO SE APLICA'];

export interface CrcCtx {
  toast: (msg: string) => void;
  empresas: () => { id: number; label: string }[];
  userName: () => string;
  podeEditar: () => boolean;
}

function sb() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}
const rid = () => Math.random().toString(36).slice(2, 10);
const dia = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const iso = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(+d) ? null : d.toISOString();
};
const txt = (v: any) => (v == null ? '' : String(v));
const nomeArquivo = (s: string) =>
  (s || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-100);

/** Garante um id estável nos itens que o HTML guarda sem id (histórico, decisões, % de obra). */
function idItem(x: any): string {
  if (!x._id) Object.defineProperty(x, '_id', { value: rid(), enumerable: false, writable: true, configurable: true });
  return x._id;
}

/** Linhas de cada tabela a partir do `db` do HTML. */
function linhas(db: any): Linhas {
  const t = Object.fromEntries(ORDEM.map(n => [n, new Map<string, Row>()])) as Linhas;
  const put = (n: Tabela, r: Row) => t[n].set(String(r[CHAVE[n] || 'id']), r);

  for (const nome of db.settings?.responsibles || []) {
    const n = String(nome || '').trim().toUpperCase();
    if (n) put('app_crc_areas', { nome: n });
  }
  for (const m of db.templates || []) {
    put('app_crc_modelos', {
      id: m.id, nome: txt(m.name).trim() || 'Modelo', base: m.id === 'tpl_base',
      estrutura: (m.blocks || []).map((b: any) => ({ name: txt(b.name), actions: (b.actions || []).map((a: any) => ({ name: txt(a.name), resps: [...(a.resps || (a.resp ? [a.resp] : []))] })) })),
    });
  }
  for (const c of db.committees || []) {
    if (!c.companyId) continue; // sem empresa não grava (o banco exige); a tela sempre pede
    put('app_crc_projetos', {
      id: c.id, company_id: c.companyId, nome: txt(c.name).trim() || 'Projeto',
      data_entrega: dia(c.delivery), data_inicio: dia(c.start),
      unidades: c.units == null || c.units === '' || isNaN(+c.units) ? null : Math.max(0, Math.round(+c.units)),
      concluido: !!c.completed, concluido_em: iso(c.completedAt),
      suspenso: !!c.paused, suspenso_em: iso(c.pausedAt), motivo_suspensao: c.pausedReason ?? null,
    });
    for (const o of c.obraHistory || []) {
      const pct = Math.min(100, Math.max(0, Math.round((+o.pct || 0) * 100) / 100));
      if (!dia(o.date)) continue;
      put('app_crc_obra_historico', { id: `${c.id}:${idItem(o)}`, projeto_id: c.id, data: dia(o.date), pct, nota: txt(o.note) });
    }
    (c.blocks || []).forEach((b: any, bi: number) => {
      put('app_crc_blocos', { id: b.id, projeto_id: c.id, nome: txt(b.name).trim() || 'Bloco', posicao: bi });
      for (const n of b.notes || []) {
        put('app_crc_decisoes', { id: `${b.id}:${idItem(n)}`, projeto_id: c.id, bloco_id: b.id, quando: iso(n.when) || new Date().toISOString(), texto: txt(n.text) });
      }
      (b.actions || []).forEach((a: any, ai: number) => {
        const st = a.status === 'CONCLUIDO' ? 'CONCLUÍDO' : STATUS.includes(a.status) ? a.status : 'NÃO INICIADO';
        put('app_crc_acoes', {
          id: a.id, projeto_id: c.id, bloco_id: b.id, posicao: ai, nome: txt(a.name).trim() || 'Ação',
          areas: [...(a.resps && a.resps.length ? a.resps : a.resp ? [a.resp] : [])].map(String),
          status: st, inicio: dia(a.start), prazo: dia(a.end), conclusao_real: dia(a.actualEnd),
          obs: txt(a.obs), marco: !!a.milestone,
        });
        for (const h of a.history || []) {
          put('app_crc_acao_historico', {
            id: `${a.id}:${idItem(h)}`, projeto_id: c.id, acao_id: a.id, quando: iso(h.when) || new Date().toISOString(),
            evento: txt(h.event) || 'EDIÇÃO', nota: txt(h.note), usuario: txt(h.user),
          });
        }
        for (const x of a.attachments || []) {
          if (!x.path) continue; // ainda não enviado ao Storage
          put('app_crc_anexos', {
            id: `${a.id}:${x.id}`, projeto_id: c.id, acao_id: a.id, nome: txt(x.name), mime: txt(x.type),
            tamanho: Math.round(+x.size || 0), storage_path: x.path, adicionado_em: iso(x.addedAt) || new Date().toISOString(),
          });
        }
      });
    });
  }
  return t;
}

/** `db` no formato do HTML a partir de app_crc_carregar(). */
function montar(r: any, userName: string) {
  const sufixo = (id: string) => id.slice(id.indexOf(':') + 1);
  const comId = <T extends object>(o: T, id: string): T => { Object.defineProperty(o, '_id', { value: id, enumerable: false, writable: true, configurable: true }); return o; };
  const acoes = new Map<string, any>();
  const blocos = new Map<string, any>();
  const projetos = new Map<string, any>();
  const committees = (r.projetos || []).map((p: any) => {
    const c = {
      id: p.id, companyId: p.company_id, name: p.nome, delivery: p.data_entrega, start: p.data_inicio, units: p.unidades,
      completed: p.concluido, completedAt: iso(p.concluido_em), paused: p.suspenso, pausedAt: iso(p.suspenso_em),
      pausedReason: p.motivo_suspensao, obraHistory: [] as any[], blocks: [] as any[],
    };
    projetos.set(p.id, c);
    return c;
  });
  for (const o of r.obra || []) {
    projetos.get(o.projeto_id)?.obraHistory.push(comId({ date: o.data, pct: +o.pct, note: o.nota || '' }, sufixo(o.id)));
  }
  for (const b of r.blocos || []) {
    const blk = { id: b.id, name: b.nome, actions: [] as any[], notes: [] as any[] };
    blocos.set(b.id, blk);
    projetos.get(b.projeto_id)?.blocks.push(blk);
  }
  for (const d of r.decisoes || []) blocos.get(d.bloco_id)?.notes.push(comId({ when: iso(d.quando), text: d.texto }, sufixo(d.id)));
  for (const a of r.acoes || []) {
    const act = {
      id: a.id, name: a.nome, resps: a.areas || [], status: a.status, start: a.inicio, end: a.prazo, actualEnd: a.conclusao_real,
      obs: a.obs || '', milestone: !!a.marco, history: [] as any[], notes: [] as any[], attachments: [] as any[],
    };
    acoes.set(a.id, act);
    blocos.get(a.bloco_id)?.actions.push(act);
  }
  for (const h of r.historico || []) {
    acoes.get(h.acao_id)?.history.push(comId({ when: iso(h.quando), event: h.evento, note: h.nota || '', user: h.usuario || '' }, sufixo(h.id)));
  }
  for (const x of r.anexos || []) {
    acoes.get(x.acao_id)?.attachments.push({ id: sufixo(x.id), name: x.nome, type: x.mime, size: +x.tamanho, path: x.storage_path, addedAt: iso(x.adicionado_em) });
  }
  return {
    settings: { responsibles: [...(r.areas || [])], userName },
    templates: (r.modelos || []).map((m: any) => ({ id: m.id, name: m.nome, blocks: m.estrutura || [] })),
    committees,
    currentCommitteeId: committees[0]?.id || null,
    _lagunaEnriched: true,
  };
}

const json = (r: Row) => JSON.stringify(r);
function emBlocos<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
async function run(q: PromiseLike<{ error: any }>) {
  const { error } = await q;
  if (error) {
    if (error.code === '42501') throw new Error('Seu perfil não tem permissão para alterar CRC › Entregas (ou a empresa do projeto).');
    throw new Error(error.message);
  }
}

class CrcStore {
  ctx: CrcCtx = { toast: () => {}, empresas: () => [], userName: () => 'Usuário', podeEditar: () => false };
  /** Últimas linhas gravadas (ou lidas) do banco. */
  private salvo: Linhas | null = null;
  private db: any = null;
  private timer: any = null;
  private gravando: Promise<void> | null = null;
  private deNovo = false;
  inicial: any = null;
  ultimaCarga = 0;

  /** Objeto que o script do HTML enxerga como window.__crcBridge (o mesmo entre recargas do módulo). */
  readonly bridge: any = ((window as any).__crcBridge ||= {});

  constructor() {
    Object.assign(this.bridge, {
      boot: () => this.inicial,
      save: (db: any) => this.agendar(db),
      toast: (m: string) => this.ctx.toast(m),
      empresas: () => this.ctx.empresas(),
      ia: (prompt: string, tipo: string) => this.ia(prompt, tipo),
      anexoUrl: (path: string, nome: string) => this.anexoUrl(path, nome),
      exportDb: (db: any) => this.exportar(db),
    });
    window.addEventListener('beforeunload', e => {
      if (this.pendente()) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  pendente() { return !!(this.timer || this.gravando); }

  private status(s: '' | 'saving' | 'ok' | 'error', texto = '') {
    const el = document.getElementById('crcSyncStatus');
    if (!el) return;
    el.className = 'crc-sync' + (s && s !== 'ok' ? ' ' + s : '');
    el.textContent = texto;
  }

  /** Lê tudo do banco; espera a gravação em andamento terminar antes. */
  async carregar() {
    await this.descarregar();
    const { data, error } = await sb().rpc('app_crc_carregar');
    if (error) throw new Error(error.code === '42501' ? 'Seu perfil não tem acesso a CRC › Entregas.' : error.message);
    const db = montar(data, this.ctx.userName());
    this.salvo = linhas(db);
    this.db = db;
    this.ultimaCarga = Date.now();
    return db;
  }

  /** Grava já o que estiver agendado. */
  async descarregar() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; await this.gravar(); }
    while (this.gravando) await this.gravando;
  }

  private agendar(db: any) {
    this.db = db;
    if (!this.ctx.podeEditar()) {
      // Perfil só de consulta: nada vai para o banco e a tela volta ao que está salvo.
      this.ctx.toast('Seu perfil só pode consultar CRC › Entregas. A alteração não foi salva.');
      this.recarregar(true);
      return;
    }
    this.status('saving', 'Salvando…');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.gravar(); }, 350);
  }

  private gravar(): Promise<void> {
    if (this.gravando) { this.deNovo = true; return this.gravando; }
    this.gravando = (async () => {
      try {
        await this.enviarAnexos(this.db);
        await this.aplicar(linhas(this.db));
        this.status('ok', 'Salvo');
      } catch (e: any) {
        this.status('error', 'Erro ao salvar');
        this.ctx.toast('Não foi possível salvar: ' + (e?.message || e) + ' A tela voltou ao que está no banco.');
        this.gravando = null;
        this.deNovo = false;
        await this.recarregar(true);
        return;
      }
      this.gravando = null;
      if (this.deNovo) { this.deNovo = false; await this.gravar(); }
    })();
    return this.gravando;
  }

  /** Upsert do que mudou e exclusão do que sumiu, tabela a tabela. */
  private async aplicar(novo: Linhas) {
    const antigo = this.salvo!;
    for (const t of ORDEM) {
      const mudou = [...novo[t].entries()].filter(([k, r]) => { const o = antigo[t].get(k); return !o || json(o) !== json(r); }).map(([, r]) => r);
      for (const lote of emBlocos(mudou, 400)) {
        await run(sb().from(t).upsert(lote, { onConflict: CHAVE[t] || 'id' }));
        for (const r of lote) antigo[t].set(String(r[CHAVE[t] || 'id']), r);
      }
    }
    for (const t of [...ORDEM].reverse()) {
      const sumiu = [...antigo[t].keys()].filter(k => !novo[t].has(k));
      for (const lote of emBlocos(sumiu, 150)) {
        await run(sb().from(t).delete().in(CHAVE[t] || 'id', lote));
        if (t === 'app_crc_anexos') {
          // Arquivo sai do Storage enquanto o projeto ainda existe (a política olha o projeto).
          const paths = lote.map(k => antigo[t].get(k)?.storage_path).filter(Boolean);
          if (paths.length) await sb().storage.from(BUCKET).remove(paths);
        }
        for (const k of lote) antigo[t].delete(k);
      }
    }
  }

  /** Sobe para o Storage os anexos novos (base64 em memória). Projeto precisa estar gravado antes. */
  private async enviarAnexos(db: any) {
    const pend: { c: any; a: any; x: any }[] = [];
    for (const c of db.committees || []) for (const b of c.blocks || []) for (const a of b.actions || []) {
      for (const x of a.attachments || []) if (!x.path && x.data) pend.push({ c, a, x });
    }
    if (!pend.length) return;
    // projeto/ação precisam existir para a política do Storage e para a FK do anexo
    await this.aplicar(linhas(db));
    for (const { c, a, x } of pend) {
      if (!x.id) x.id = 'att_' + rid();
      const path = `${c.id}/${a.id}/${x.id}-${nomeArquivo(x.name)}`;
      const blob = await (await fetch(x.data)).blob();
      const { error } = await sb().storage.from(BUCKET).upload(path, blob, { contentType: x.type || 'application/octet-stream', upsert: true });
      if (error) throw new Error(`anexo "${x.name}": ${error.message}`);
      x.path = path;
      delete x.data;
    }
  }

  /** Relê o banco e redesenha a tela (sem mexer se houver gravação pendente, salvo `forcar`). */
  async recarregar(forcar = false) {
    if (!forcar && this.pendente()) return;
    try {
      if (forcar) { if (this.timer) clearTimeout(this.timer); this.timer = null; }
      const db = await this.carregar();
      (window as any).crcApplyServerDb?.(db);
    } catch (e: any) {
      this.ctx.toast('Não foi possível recarregar CRC › Entregas: ' + e.message);
    }
  }

  private async ia(prompt: string, tipo: string): Promise<string> {
    try {
      const r = await invoke<{ texto: string }>('app-ia', { tela: 'crc', tipo, prompt });
      return r.texto;
    } catch (e: any) {
      if (e.status === 503) throw new Error('IA não configurada no servidor (IA_API_KEY / IA_MODEL).');
      throw e;
    }
  }

  private async anexoUrl(path: string, nome: string) {
    const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 120, { download: nome || true });
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  /** Backup JSON no formato do HTML (anexos só com nome/caminho, sem o arquivo). */
  private exportar(db: any) {
    return JSON.parse(JSON.stringify({ ...db, _lagunaEnriched: true }, (k, v) => (k === '_open' || k === 'data' ? undefined : v)));
  }
}

export const crcStore = new CrcStore();
