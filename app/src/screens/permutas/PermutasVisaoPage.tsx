// Permutas › Terrenos › Visão Geral: como as unidades permutadas estão distribuídas pelos terrenos e
// empreendimentos (antiga aba "Unidades nos empreendimentos" do Painel de Permutas).
// Unidades = as vinculadas nas permutas de área (Cadastros) + as cadastradas direto aqui.
import { useEffect, useMemo, useState } from 'react';
import './permutas.css';
import { m2, type EmpreendimentoFicha, type Permuta, type UnidadeDireta } from '../../lib/permutas';
import { montarUnidades, type LinhaUnidade } from './analise';
import { FiltroBusca, useColunas, exportarExcel, IcExcel, type Coluna } from './ui';
import { useBasePermutas, Kpi, ModalPermutaStore, dataBr, semAcento, IcPlus, type PermutasCtx } from './comum';
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
const TIPOS_EMP = ['Vertical', 'Horizontal', 'Loteamento'];
const TIPOS_PERMUTA = ['Física no Empreendimento', 'Física de outro Empreendimento', 'Física no Empreendimento/Física de outro Empreendimento', 'Financeira', 'Compra de participação'];
const STATUS = ['Temos contrato', 'Temos lançamento no Sienge', 'Considerações'];

export default function PermutasVisaoPage({ v }: { v: any }) {
  const { ctx, ativo, dados, empresas, nomeOrigem, nomeEmp } = useBasePermutas(v, 'visao');
  const { permutas, diretas, fichas, catalogo, carregado, erro } = dados;
  const [fEmp, setFEmp] = useState('');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<{ tipo: 'permuta'; p: Permuta } | { tipo: 'unidade'; u: UnidadeDireta | null } | { tipo: 'ficha'; f: Partial<EmpreendimentoFicha> | null } | null>(null);
  const cols = useColunas('visao', COLUNAS);

  const todas = useMemo(() => montarUnidades(permutas, diretas, catalogo, nomeOrigem), [permutas, diretas, catalogo, empresas, dados.negocios]);
  // Cartões: empreendimentos com unidades + fichas cadastradas (inclusive terrenos sem unidade ainda).
  const cartoes = useMemo(() => {
    const m = new Map<string, { chave: string; enterprise_id: number | null; nome: string; ficha?: EmpreendimentoFicha; linhas: LinhaUnidade[] }>();
    todas.forEach(l => {
      const ch = 'e' + l.enterprise_id;
      if (!m.has(ch)) m.set(ch, { chave: ch, enterprise_id: l.enterprise_id, nome: nomeEmp(l.enterprise_id), linhas: [] });
      m.get(ch)!.linhas.push(l);
    });
    fichas.forEach(f => {
      const ch = f.enterprise_id != null ? 'e' + f.enterprise_id : 'f' + f.id;
      const c = m.get(ch) || { chave: ch, enterprise_id: f.enterprise_id, nome: f.nome, linhas: [] };
      m.set(ch, { ...c, nome: f.nome || c.nome, ficha: f });
    });
    return [...m.values()].sort((a, b) => b.linhas.length - a.linhas.length || a.nome.localeCompare(b.nome));
  }, [todas, fichas, catalogo]);

  const q = semAcento(busca.trim());
  const linhas = todas
    .filter(l => !fEmp || 'e' + l.enterprise_id === fEmp)
    .filter(l => !q || semAcento([nomeEmp(l.enterprise_id), l.unidade, l.permutante, l.origem, l.obs].join(' ')).includes(q))
    .sort((a, b) => nomeEmp(a.enterprise_id).localeCompare(nomeEmp(b.enterprise_id)) || a.unidade.localeCompare(b.unidade, 'pt-BR', { numeric: true }));
  const nDir = linhas.filter(l => l.kind !== 'via').length, nVia = linhas.filter(l => l.kind !== 'dir').length;
  const area = linhas.reduce((s, l) => s + (l.metragem || 0), 0);
  const semM2 = linhas.filter(l => l.metragem == null).length;
  const nPerm = new Set(linhas.map(l => l.permutante.trim().toUpperCase()).filter(Boolean)).size;
  const nEmp = new Set(linhas.map(l => l.enterprise_id)).size;

  const origemTxt = (l: LinhaUnidade) => l.kind === 'dir' ? 'Cadastro de unidades' : l.kind === 'ambos' ? 'Cadastro + permuta de área' : l.proprio ? 'Permuta no próprio emp.' : 'Permuta de área';
  const exportar = () => exportarExcel('permutas-terrenos-visao-geral.xlsx', 'Unidades',
    ['Empreendimento', 'Código', 'Unidade', 'Metragem (m²)', 'Permutante', 'Data do contrato', 'Origem', 'Área de origem', 'Observação'],
    linhas.map(l => [nomeEmp(l.enterprise_id), l.enterprise_id, l.unidade, l.metragem, l.permutante, dataBr(l.data), origemTxt(l), l.origem, l.obs]),
  ).catch(e => ctx?.toast('Não foi possível gerar a planilha: ' + (e?.message || e)));

  if (!ativo || !ctx) return null;
  const podeEditar = ctx.podeEditar();
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
          {podeEditar ? <button type="button" className="pm-btn" onClick={() => setModal({ tipo: 'ficha', f: null })} disabled={!carregado}><IcPlus />Empreendimento</button> : null}
        </div>
      </div>

      {erro ? <div className="pm-err">Não foi possível carregar: {erro}</div> : null}

      <div className="pm-kpis">
        <Kpi fundo="#EAF1FF" rotulo="Unidades permutadas" valor={String(linhas.length)} sub={`${nDir} cadastradas · ${nVia} via permutas de áreas`}
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
          <div><b>Empreendimentos</b><span>Clique num cartão para filtrar as unidades abaixo.</span></div>
          {fEmp ? <button type="button" className="pm-link rt" onClick={() => setFEmp('')}>Limpar filtro</button> : null}
        </div>
        {!carregado && !erro ? <div className="pm-empty">Carregando…</div> : null}
        {carregado && !cartoes.length ? <div className="pm-empty"><b>Nenhum empreendimento ainda.</b>Vincule unidades nos Cadastros ou use “Empreendimento”.</div> : null}
        <div className="pm-emp-grid">
          {cartoes.map(c => {
            const f = c.ficha, m = c.linhas.reduce((s, l) => s + (l.metragem || 0), 0), via = c.linhas.filter(l => l.kind !== 'dir').length;
            const sel = fEmp === c.chave;
            return (
              <div key={c.chave} className={'pm-emp' + (sel ? ' sel' : '')} role="button" tabIndex={0}
                onClick={() => setFEmp(sel ? '' : c.chave)} onKeyDown={e => { if (e.key === 'Enter') setFEmp(sel ? '' : c.chave); }}>
                <div className="nm">
                  <span>{c.enterprise_id != null ? <span className="pm-code" style={{ marginRight: '6px' }}>{c.enterprise_id}</span> : null}{c.nome}</span>
                  <span className="qt">{c.linhas.length} unid.</span>
                </div>
                <div className="fig">{m2(m)} m²{via ? ` · ${via} via áreas` : ''}{f?.tipo ? ` · ${f.tipo}` : ''}</div>
                {f?.tipo_permuta ? <div className="fig">{f.tipo_permuta}</div> : null}
                {f?.status || f?.alerta ? (
                  <div className="chips">
                    {f.status ? <span className="pm-chip ok"><i />{f.status}</span> : null}
                    {f.alerta ? <span className="pm-chip warn"><i />{f.alerta}</span> : null}
                  </div>
                ) : null}
                {f?.acao ? <div className="acao"><b>Ação:</b> {f.acao}</div> : null}
                {podeEditar ? (
                  <div style={{ marginTop: 'auto' }}>
                    <button type="button" className="pm-btn sm" onClick={e => { e.stopPropagation(); setModal({ tipo: 'ficha', f: f || { enterprise_id: c.enterprise_id, nome: c.nome } }); }}>Editar</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="pm-filters">
        <div className="pm-f" style={{ flex: '0 1 300px' }}>
          <span className="pm-cap">Empreendimento</span>
          <FiltroBusca value={fEmp} onChange={setFEmp} todos="Todos os empreendimentos" placeholder="Buscar empreendimento…"
            opcoes={cartoes.map(c => ({ value: c.chave, label: c.nome, sub: c.enterprise_id != null ? String(c.enterprise_id) : 'Terreno' }))} />
        </div>
        <label className="pm-f" style={{ flex: '1 1 240px' }}>
          <span className="pm-cap">Buscar</span>
          <input className="pm-in" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Unidade, permutante, origem…" />
        </label>
      </div>

      <div className="pm-tbl">
        <div className="pm-tbl-in">
          {cols.cabecalho}
          {carregado && !linhas.length ? <div className="pm-empty"><b>Nenhuma unidade para este filtro.</b></div> : null}
          {linhas.map(l => (
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
      </div>

      {modal?.tipo === 'permuta' ? <ModalPermutaStore permuta={modal.p} ctx={ctx} empresas={empresas} fechar={() => setModal(null)} /> : null}
      {modal?.tipo === 'unidade' ? <UnidadeModal u={modal.u} ctx={ctx} nomeEmp={nomeEmp} fechar={() => setModal(null)} /> : null}
      {modal?.tipo === 'ficha' ? <FichaModal f={modal.f} ctx={ctx} nomeEmp={nomeEmp} unidadesNoEmp={n => todas.filter(l => l.enterprise_id === n).length} fechar={() => setModal(null)} /> : null}
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
        <label className="pm-f">
          <span className="pm-cap">Empreendimento <span className="pm-req">*</span></span>
          <select className="pm-in" value={emp} disabled={ro} onChange={e => { setEmp(e.target.value ? +e.target.value : ''); setUid(''); }}>
            <option value="">Selecione…</option>
            {emps.map(id => <option key={id} value={id}>{nomeEmp(id)} · {id}</option>)}
          </select>
        </label>
        <label className="pm-f">
          <span className="pm-cap">Unidade <span className="pm-req">*</span></span>
          <select className="pm-in" value={uid} disabled={ro || !emp} onChange={e => setUid(e.target.value ? +e.target.value : '')}>
            <option value="">{emp ? 'Selecione…' : '—'}</option>
            {unidades.map(c => <option key={c.unidade_id} value={c.unidade_id}>{c.unidade}</option>)}
          </select>
        </label>
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

/** Ficha do empreendimento/terreno: tipo, tipo de permuta, status, alerta curto e ação. */
function FichaModal({ f, ctx, nomeEmp, unidadesNoEmp, fechar }: {
  f: Partial<EmpreendimentoFicha> | null; ctx: PermutasCtx; nomeEmp: (e: number) => string; unidadesNoEmp: (e: number) => number; fechar: () => void;
}) {
  const { catalogo } = usePermutas();
  const ro = !ctx.podeEditar();
  const [emp, setEmp] = useState<number | ''>(f?.enterprise_id ?? '');
  const [nome, setNome] = useState(f?.nome || '');
  const [tipo, setTipo] = useState(f?.tipo || '');
  const [tp, setTp] = useState(f?.tipo_permuta || '');
  const [st, setSt] = useState(f?.status || '');
  const [alerta, setAlerta] = useState(f?.alerta || '');
  const [acao, setAcao] = useState(f?.acao || '');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const emps = useMemo(() => [...new Set(catalogo.map(c => c.enterprise_id))].sort((a, b) => nomeEmp(a).localeCompare(nomeEmp(b))), [catalogo]);
  const salvar = async () => {
    setErro('');
    const n = nome.trim() || (emp ? nomeEmp(emp) : '');
    if (!n) { setErro('Informe o nome ou escolha o empreendimento do Sienge.'); return; }
    setOcupado(true);
    try {
      await permutasStore.salvarFicha({ id: f?.id, enterprise_id: emp === '' ? null : emp, nome: n, tipo: tipo || null, tipo_permuta: tp.trim() || null, status: st.trim() || null, alerta: alerta.trim() || null, acao: acao.trim() || null });
      ctx.toast('Empreendimento salvo'); fechar();
    } catch (e: any) { setErro(e?.message || String(e)); setOcupado(false); }
  };
  const excluir = async () => {
    if (!f?.id) return;
    // Só a ficha sai; as unidades continuam (o cartão segue aparecendo enquanto houver unidades).
    const n = f.enterprise_id != null ? unidadesNoEmp(f.enterprise_id) : 0;
    try { await permutasStore.excluirFicha(f.id); ctx.toast(n ? `Ficha excluída · ${n} unidade(s) continuam no empreendimento` : 'Ficha excluída'); fechar(); }
    catch (e: any) { setErro(e?.message || String(e)); }
  };
  return (
    <Moldura titulo={f?.id ? `Editar ${f.nome}` : f?.nome ? f.nome : 'Novo empreendimento'} sub="Terreno ou empreendimento que recebe unidades em permuta." fechar={fechar}
      rodape={<>
        {f?.id && !ro ? <button type="button" className="pm-btn danger" onClick={excluir}>Excluir ficha</button> : null}
        <div className="r">
          <button type="button" className="pm-btn" onClick={fechar}>{ro ? 'Fechar' : 'Cancelar'}</button>
          {ro ? null : <button type="button" className="pm-btn prim" disabled={ocupado} onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar'}</button>}
        </div>
      </>}>
      <div className="pm-g2">
        <label className="pm-f">
          <span className="pm-cap">Empreendimento do Sienge</span>
          <select className="pm-in" value={emp} disabled={ro || !!f?.id} onChange={e => { const id = e.target.value ? +e.target.value : ''; setEmp(id); if (id && !nome.trim()) setNome(nomeEmp(id)); }}>
            <option value="">Nenhum (terreno / área)</option>
            {emps.map(id => <option key={id} value={id}>{nomeEmp(id)} · {id}</option>)}
          </select>
        </label>
        <label className="pm-f">
          <span className="pm-cap">Nome <span className="pm-req">*</span></span>
          <input className="pm-in" value={nome} disabled={ro} onChange={e => setNome(e.target.value)} placeholder="Ex.: 190 - EV Liberta - Jataí" />
        </label>
        <label className="pm-f">
          <span className="pm-cap">Tipo de empreendimento</span>
          <select className="pm-in" value={tipo} disabled={ro} onChange={e => setTipo(e.target.value)}>
            <option value="">—</option>
            {TIPOS_EMP.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="pm-f">
          <span className="pm-cap">Status atual da permuta</span>
          <input className="pm-in" list="pm-status" value={st} disabled={ro} onChange={e => setSt(e.target.value)} />
          <datalist id="pm-status">{STATUS.map(s => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="pm-f pm-full">
          <span className="pm-cap">Tipo de permuta</span>
          <input className="pm-in" list="pm-tipos" value={tp} disabled={ro} onChange={e => setTp(e.target.value)} />
          <datalist id="pm-tipos">{TIPOS_PERMUTA.map(s => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="pm-f pm-full">
          <span className="pm-cap">Alerta curto</span>
          <input className="pm-in" value={alerta} disabled={ro} onChange={e => setAlerta(e.target.value)} placeholder="Ex.: Fluxo está errado" />
        </label>
        <label className="pm-f pm-full">
          <span className="pm-cap">Ação</span>
          <textarea className="pm-in" value={acao} disabled={ro} onChange={e => setAcao(e.target.value)} placeholder="Ex.: Checar lançamento do permutante e baixas por bens" />
        </label>
      </div>
      {erro ? <div className="pm-err">{erro}</div> : null}
    </Moldura>
  );
}
