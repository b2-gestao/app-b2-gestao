// Permutas › Terrenos › Visão Geral: resumo do que foi cadastrado nas permutas (por área/empreendimento de
// origem) e como as unidades permutadas estão distribuídas (antiga aba "Unidades nos empreendimentos").
// Unidades = as vinculadas nas permutas de área (Cadastros) + as cadastradas direto aqui.
// Áreas/empreendimentos nascem no cadastro do permutante; esta tela só lê, não cria empreendimento.
import { useEffect, useMemo, useState } from 'react';
import './permutas.css';
import { m2, type Permuta, type UnidadeDireta } from '../../lib/permutas';
import { analisar, chaveOrigem, montarUnidades, type LinhaUnidade } from './analise';
import { SeletorBusca } from './busca';
import { FiltroBusca, Paginacao, useColunas, usePaginacao, exportarExcel, IcExcel, type Coluna } from './ui';
import { useBasePermutas, Kpi, ModalPermutaStore, dataBr, semAcento, type PermutasCtx } from './comum';
import { permutasStore, usePermutas } from './store';

const COLUNAS: Coluna[] = [
  { key: 'emp', label: 'Empreendimento', w: 220, min: 120 },
  { key: 'un', label: 'Unidade', w: 110, min: 70 },
  { key: 'm2', label: 'Metragem (m²)', w: 120, num: true },
  { key: 'perm', label: 'Permutante', w: 230, min: 100 },
  { key: 'dt', label: 'Data contrato', w: 110 },
  { key: 'orig', label: 'Origem', w: 260, min: 120 },
  { key: 'obs', label: 'Observação', w: 240, min: 100 },
];
const POR_PAGINA = [30, 100] as const;
const GRAFICO_INICIAL = 12;

export default function PermutasVisaoPage({ v }: { v: any }) {
  const { ctx, ativo, dados, empresas, nomeOrigem, nomeEmp } = useBasePermutas(v, 'visao');
  const { permutas, diretas, catalogo, carregado, erro } = dados;
  const [fEmp, setFEmp] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [fPerm, setFPerm] = useState('');
  const [busca, setBusca] = useState('');
  const [grafTodos, setGrafTodos] = useState(false);
  const [modal, setModal] = useState<{ tipo: 'permuta'; p: Permuta } | { tipo: 'unidade'; u: UnidadeDireta | null } | null>(null);
  const cols = useColunas('visao', COLUNAS);

  const an = useMemo(() => analisar(permutas, diretas, catalogo, nomeOrigem, nomeEmp), [permutas, diretas, catalogo, empresas, dados.negocios]);
  const todas = useMemo(() => montarUnidades(permutas, diretas, catalogo, nomeOrigem), [permutas, diretas, catalogo, empresas, dados.negocios]);
  const terrenos = an.porTerreno;
  const empsComUnidade = useMemo(() => [...new Set(todas.map(l => l.enterprise_id))].map(id => ({ id, nome: nomeEmp(id) })).sort((a, b) => a.nome.localeCompare(b.nome)), [todas, catalogo]);
  const maxT = Math.max(1, ...terrenos.map(t => t.proprio + t.div));
  const permutantes = useMemo(() => {
    const m = new Map<string, string>();
    todas.forEach(l => { const n = l.permutante.trim(); if (n && !m.has(n.toUpperCase())) m.set(n.toUpperCase(), n); });
    return [...m.entries()].map(([chave, nome]) => ({ chave, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [todas]);
  const filtrando = !!(fEmp || fOrigem || fPerm);
  const limparFiltros = () => { setFEmp(''); setFOrigem(''); setFPerm(''); };

  const q = semAcento(busca.trim());
  const linhas = todas
    .filter(l => !fEmp || 'e' + l.enterprise_id === fEmp)
    .filter(l => !fOrigem || (l.permuta && chaveOrigem(l.permuta) === fOrigem))
    .filter(l => !fPerm || l.permutante.trim().toUpperCase() === fPerm)
    .filter(l => !q || semAcento([nomeEmp(l.enterprise_id), l.unidade, l.permutante, l.origem, l.obs].join(' ')).includes(q))
    .sort((a, b) => nomeEmp(a.enterprise_id).localeCompare(nomeEmp(b.enterprise_id)) || a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));
  const nVia = linhas.filter(l => l.kind !== 'dir').length;
  const area = linhas.reduce((s, l) => s + (l.metragem || 0), 0);
  const semM2 = linhas.filter(l => l.metragem == null).length;
  const nPerm = new Set(linhas.map(l => l.permutante.trim().toUpperCase()).filter(Boolean)).size;
  const nEmp = new Set(linhas.map(l => l.enterprise_id)).size;
  const pg = usePaginacao(linhas, POR_PAGINA, [fEmp, fOrigem, fPerm, busca]);

  const origemTxt = (l: LinhaUnidade) => l.kind === 'dir' ? 'Cadastro de unidades' : l.kind === 'ambos' ? 'Cadastro + permuta de área' : l.proprio ? 'Permuta no próprio emp.' : 'Permuta de área';
  const exportar = () => exportarExcel('permutas-terrenos-visao-geral.xlsx', 'Unidades',
    ['Empreendimento', 'Código', 'Unidade', 'Metragem (m²)', 'Permutante', 'Data do contrato', 'Origem', 'Área de origem', 'Observação'],
    linhas.map(l => [nomeEmp(l.enterprise_id), l.enterprise_id, l.unidade, l.metragem, l.permutante, dataBr(l.data), origemTxt(l), l.origem, l.obs]),
  ).catch(e => ctx?.toast('Não foi possível gerar a planilha: ' + (e?.message || e)));

  if (!ativo || !ctx) return null;
  const abrirLinha = (l: LinhaUnidade) => {
    if (l.direta) setModal({ tipo: 'unidade', u: l.direta });
    else if (l.permuta) setModal({ tipo: 'permuta', p: l.permuta });
  };

  return (
    <main className="pm-main">
      <div className="pm-head">
        <div>
          <div className="t">Visão Geral</div>
          <div className="s">Como as unidades permutadas estão distribuídas pelos terrenos e empreendimentos. Inclui as unidades vinculadas nas permutas de área (Cadastros) e as cadastradas direto aqui.</div>
        </div>
        <div className="acts">
          <button type="button" className="ia-cta" style={{ height: '38px', padding: '0 16px 0 13px', fontSize: '13px' }} onClick={() => ctx.ir('insights')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" /></svg>
            Insights
          </button>
          <button type="button" className="pm-btn" onClick={exportar} disabled={!linhas.length}><IcExcel />Exportar Excel</button>
        </div>
      </div>

      {erro ? <div className="pm-err">Não foi possível carregar: {erro}</div> : null}

      <div className="pm-kpis">
        <Kpi fundo="#EAF1FF" rotulo="Unidades permutadas" valor={String(linhas.length)} sub="Vinculadas no cadastro da permuta"
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="3.5" width="16" height="17" rx="2" stroke="#4161FF" strokeWidth="1.7" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10 20.5v-4h4v4" stroke="#4161FF" strokeWidth="1.6" strokeLinecap="round" /></svg>} />
        <Kpi cor="#258B6C" fundo="#E1F7EF" rotulo="Área privativa" valor={m2(area)} un="m²" sub={semM2 ? `${semM2} unid. sem m² informado` : 'todas com m²'}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#35AD88" strokeWidth="1.7" /><path d="M4 12h16M12 4v16" stroke="#35AD88" strokeWidth="1.5" /></svg>} />
        <Kpi fundo="#F1E9FF" rotulo="Permutantes" valor={String(nPerm)} sub={`em ${nEmp} empreendimento${nEmp === 1 ? '' : 's'}`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="#7C3AED" strokeWidth="1.6" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M16 5.5a3 3 0 010 5.5M18 14.5c1.4.7 2.3 2.2 2.6 4.5" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" /></svg>} />
        <Kpi cor="#D97706" fundo="#FFF0DD" rotulo="Via permutas de áreas" valor={String(nVia)} sub="unidades citadas nos Cadastros"
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
      </div>

      <section className="pm-panel">
        <div className="pm-panel-h">
          <div><b>Área de permuta por área/empreendimento (m²)</b><span>Quanto de cada área foi permutado no próprio empreendimento e em empreendimentos diversos.</span></div>
          <div className="pm-leg rt"><em className="p">No próprio empreendimento</em><em className="g">Em empreendimentos diversos</em></div>
        </div>
        {!carregado && !erro ? <div className="pm-empty">Carregando…</div> : null}
        {carregado && !terrenos.length ? <div className="pm-empty"><b>Nenhuma permuta cadastrada ainda.</b>Cadastre o permutante em Cadastros para ver a distribuição.</div> : null}
        <div className="pm-bars">
          {(grafTodos ? terrenos : terrenos.slice(0, GRAFICO_INICIAL)).map(t => (
            <div key={t.chave} className="pm-bar-row" title={`${t.nome}: próprio ${m2(t.proprio)} · diversos ${m2(t.div)} m²`}>
              <span className="nm pm-ell">{t.nome}</span>
              <span className="trk"><i className="p" style={{ width: (t.proprio / maxT) * 100 + '%' }} /><i className="g" style={{ width: (t.div / maxT) * 100 + '%' }} /></span>
              <span className="vl">{m2(t.area)}</span>
            </div>
          ))}
        </div>
        {terrenos.length > GRAFICO_INICIAL ? (
          <button type="button" className="pm-link" style={{ alignSelf: 'flex-start' }} onClick={() => setGrafTodos(x => !x)}>
            {grafTodos ? 'Mostrar menos' : `Ver todas as ${terrenos.length} áreas`}
          </button>
        ) : null}
      </section>

      <section className="pm-panel">
        <div className="pm-panel-h">
          <div><b>Resumo das permutas cadastradas</b><span>Uma ficha por área/empreendimento, com o que foi cadastrado em Cadastros. Clique num cartão para filtrar as unidades abaixo.</span></div>
          {filtrando ? <button type="button" className="pm-link rt" onClick={limparFiltros}>Limpar filtro</button> : null}
        </div>
        {!carregado && !erro ? <div className="pm-empty">Carregando…</div> : null}
        {carregado && !terrenos.length ? <div className="pm-empty"><b>Nenhuma permuta cadastrada ainda.</b>O empreendimento nasce no cadastro do permutante, em Cadastros.</div> : null}
        <div className="pm-emp-grid">
          {terrenos.map(t => {
            const sel = fOrigem === t.chave, tot = t.proprio + t.div;
            const alocPct = t.area ? Math.round((t.aloc / t.area) * 100) : null;
            return (
              <div key={t.chave} className={'pm-emp' + (sel ? ' sel' : '')} role="button" tabIndex={0} aria-pressed={sel}
                onClick={() => setFOrigem(sel ? '' : t.chave)} onKeyDown={e => { if (e.key === 'Enter') setFOrigem(sel ? '' : t.chave); }}>
                <div className="nm">
                  <span>{t.nome}</span>
                  <span className="qt">{t.n} permut.</span>
                </div>
                <div className="fig"><b>{m2(t.area)} m²</b> de permuta</div>
                <div className="pm-cbar" title={`Próprio ${m2(t.proprio)} · diversos ${m2(t.div)} m²`}>
                  <i className="p" style={{ width: (tot ? (t.proprio / tot) * 100 : 0) + '%' }} /><i className="g" style={{ width: (tot ? (t.div / tot) * 100 : 0) + '%' }} />
                </div>
                <div className="fig">Próprio {m2(t.proprio)} · Diversos {m2(t.div)}</div>
                <div className="chips">
                  <span className={'pm-chip ' + (t.unidades ? 'info' : 'warn')}><i />{t.unidades} unid. vinculadas{alocPct != null ? ` · ${alocPct}% alocado` : ''}</span>
                  {t.pend ? <span className="pm-chip warn"><i />{t.pend} com pendência de alocação</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="pm-sec">
        <b>Distribuição de unidades</b>
        <span>Unidades permutadas por empreendimento, permutante e área de origem.</span>
      </div>

      <div className="pm-filters">
        <div className="pm-f" style={{ flex: '1 1 220px' }}>
          <span className="pm-cap">Empreendimento</span>
          <FiltroBusca value={fEmp} onChange={setFEmp} todos="Todos os empreendimentos" placeholder="Buscar empreendimento…"
            opcoes={empsComUnidade.map(e => ({ value: 'e' + e.id, label: e.nome, sub: String(e.id) }))} />
        </div>
        <div className="pm-f" style={{ flex: '1 1 220px' }}>
          <span className="pm-cap">Origem</span>
          <FiltroBusca value={fOrigem} onChange={setFOrigem} todos="Todas as origens" placeholder="Buscar origem…"
            opcoes={terrenos.map(t => ({ value: t.chave, label: t.nome }))} />
        </div>
        <div className="pm-f" style={{ flex: '1 1 220px' }}>
          <span className="pm-cap">Permutante</span>
          <FiltroBusca value={fPerm} onChange={setFPerm} todos="Todos os permutantes" placeholder="Buscar permutante…"
            opcoes={permutantes.map(p => ({ value: p.chave, label: p.nome }))} />
        </div>
        <label className="pm-f" style={{ flex: '1 1 220px' }}>
          <span className="pm-cap">Buscar</span>
          <input className="pm-in" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Unidade, permutante, origem…" />
        </label>
      </div>

      <div className="pm-tbl">
        <div className="pm-tbl-in">
          {cols.cabecalho}
          {carregado && !linhas.length ? <div className="pm-empty"><b>Nenhuma unidade para este filtro.</b></div> : null}
          {pg.visiveis.map(l => (
            <div key={l.chave} className={'pm-tr row' + (l.kind === 'via' ? ' via' : '')} style={cols.estilo} tabIndex={0} title={l.kind === 'via' ? 'Abrir a permuta' : 'Editar a unidade'}
              onClick={() => abrirLinha(l)} onKeyDown={e => { if (e.key === 'Enter') abrirLinha(l); }}>
              <span className="pm-ell" style={{ color: '#64748B' }}>{nomeEmp(l.enterprise_id)}</span>
              <b className="pm-ell" style={{ fontWeight: 600, color: '#111827' }}>{l.unidade}</b>
              <span className="pm-n">{m2(l.metragem)}</span>
              <span className="pm-ell">{l.permutante || '—'}</span>
              <span>{dataBr(l.data) || '—'}</span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span><span className={'pm-chip ' + (l.kind === 'via' && !l.proprio ? 'warn' : l.kind === 'dir' ? 'info' : 'ok')}><i />{origemTxt(l)}</span></span>
                {l.origem ? <span className="pm-ell" style={{ fontSize: '11.5px', color: '#94A3B8' }}>{l.origem}</span> : null}
              </span>
              <span className="pm-ell" style={{ color: '#64748B' }}>{l.obs || ''}</span>
            </div>
          ))}
          {linhas.length ? (
            <div className="pm-tr tot" style={cols.estilo}>
              <span>Total · {linhas.length} unidades</span><span /><span className="pm-n">{m2(area)}</span><span /><span /><span /><span />
            </div>
          ) : null}
        </div>
        <Paginacao pg={pg} rotulo="unidades" />
      </div>

      {modal?.tipo === 'permuta' ? <ModalPermutaStore permuta={modal.p} ctx={ctx} empresas={empresas} fechar={() => setModal(null)} /> : null}
      {modal?.tipo === 'unidade' ? <UnidadeModal u={modal.u} ctx={ctx} nomeEmp={nomeEmp} fechar={() => setModal(null)} /> : null}
    </main>
  );
}

function Moldura({ titulo, sub, children, rodape, fechar }: { titulo: string; sub: string; children: React.ReactNode; rodape: React.ReactNode; fechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [fechar]);
  return (
    <div className="pm-ov" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pm-modal" style={{ maxWidth: '620px' }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="pm-mh">
          <div className="pm-mic">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10 20.5v-4h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </div>
          <div><div className="pm-mt">{titulo}</div><div className="pm-ms">{sub}</div></div>
          <button type="button" className="pm-x" title="Fechar" onClick={fechar}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="pm-mb">{children}</div>
        <div className="pm-mf">{rodape}</div>
      </div>
    </div>
  );
}

/** Unidade permutada cadastrada direto (sem permuta de área). */
function UnidadeModal({ u, ctx, nomeEmp, fechar }: { u: UnidadeDireta | null; ctx: PermutasCtx; nomeEmp: (e: number) => string; fechar: () => void }) {
  const { catalogo } = usePermutas();
  const ro = !ctx.podeEditar();
  const [emp, setEmp] = useState<number | ''>(u?.enterprise_id ?? '');
  const [uid, setUid] = useState<number | ''>(u?.unidade_id ?? '');
  const [perm, setPerm] = useState(u?.permutante || '');
  const [dt, setDt] = useState(u?.data_contrato?.slice(0, 10) || '');
  const [obs, setObs] = useState(u?.observacao || '');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirma, setConfirma] = useState(false);
  const emps = useMemo(() => [...new Set(catalogo.map(c => c.enterprise_id))].sort((a, b) => nomeEmp(a).localeCompare(nomeEmp(b))), [catalogo]);
  const unidades = catalogo.filter(c => c.enterprise_id === emp);
  const cat = catalogo.find(c => c.unidade_id === uid);
  const salvar = async () => {
    setErro('');
    if (!emp || !uid || !cat) { setErro('Escolha o empreendimento e a unidade.'); return; }
    setOcupado(true);
    try {
      await permutasStore.salvarDireta({ id: u?.id, enterprise_id: emp, unidade_id: uid, unidade_nome: cat.unidade, area_privativa: cat.area_privativa, valor_unidade: u?.valor_unidade ?? null, permutante: perm.trim() || null, data_contrato: dt || null, observacao: obs.trim() || null });
      ctx.toast(u ? 'Unidade salva' : 'Unidade adicionada'); fechar();
    } catch (e: any) { setErro(e?.message || String(e)); setOcupado(false); }
  };
  return (
    <Moldura titulo={u ? 'Editar unidade permutada' : 'Nova unidade permutada'} sub="Unidade dada em permuta sem passar pelo cadastro de áreas." fechar={fechar}
      rodape={<>
        {u && !ro ? (confirma
          ? <span className="pm-confirm">Excluir a unidade {u.unidade_nome}?<button type="button" className="pm-btn sm danger" onClick={async () => { await permutasStore.excluirDireta(u.id); ctx.toast('Unidade excluída'); fechar(); }}>Sim, excluir</button><button type="button" className="pm-btn sm" onClick={() => setConfirma(false)}>Não</button></span>
          : <button type="button" className="pm-btn danger" onClick={() => setConfirma(true)}>Excluir</button>) : null}
        <div className="r">
          <button type="button" className="pm-btn" onClick={fechar}>{ro ? 'Fechar' : 'Cancelar'}</button>
          {ro ? null : <button type="button" className="pm-btn prim" disabled={ocupado} onClick={salvar}>{ocupado ? 'Salvando…' : u ? 'Salvar' : 'Adicionar'}</button>}
        </div>
      </>}>
      <div className="pm-g2">
        <div className="pm-f">
          <span className="pm-cap">Empreendimento <span className="pm-req">*</span></span>
          <SeletorBusca ariaLabel="Empreendimento" value={emp} disabled={ro} altura={38} placeholder="Buscar empreendimento…"
            onChange={id => { setEmp(id); setUid(''); }}
            opcoes={emps.map(id => ({ value: id, label: nomeEmp(id), sub: String(id) }))} />
        </div>
        <div className="pm-f">
          <span className="pm-cap">Unidade <span className="pm-req">*</span></span>
          <SeletorBusca ariaLabel="Unidade" value={uid} disabled={ro || !emp} altura={38} buscaNoDetalhe={false} placeholder={emp ? 'Buscar unidade…' : '—'} vazio="Nenhuma unidade com esse nome."
            onChange={setUid}
            opcoes={[...unidades].sort((x, y) => x.unidade.localeCompare(y.unidade, 'pt-BR', { numeric: true }))
              .map(c => ({ value: c.unidade_id, label: c.unidade, sub: c.area_privativa != null ? m2(c.area_privativa) + ' m²' : undefined }))} />
        </div>
        <div className="pm-f">
          <span className="pm-cap">Área privativa</span>
          <div className={'pm-ro' + (cat?.area_privativa == null ? ' vazio' : '')} style={{ justifyContent: 'flex-start', height: '38px' }}>{cat?.area_privativa == null ? '— m²' : m2(cat.area_privativa) + ' m²'}</div>
        </div>
        <label className="pm-f">
          <span className="pm-cap">Data do contrato</span>
          <input type="date" className="pm-in" value={dt} disabled={ro} onChange={e => setDt(e.target.value)} />
        </label>
        <label className="pm-f pm-full">
          <span className="pm-cap">Permutante</span>
          <input className="pm-in" value={perm} disabled={ro} onChange={e => setPerm(e.target.value)} placeholder="Nome completo" />
        </label>
        <label className="pm-f pm-full">
          <span className="pm-cap">Observação</span>
          <textarea className="pm-in" value={obs} disabled={ro} onChange={e => setObs(e.target.value)} placeholder="Ex.: vagas 04 e 05, escaninho 54" />
        </label>
      </div>
      {erro ? <div className="pm-err">{erro}</div> : null}
    </Moldura>
  );
}
