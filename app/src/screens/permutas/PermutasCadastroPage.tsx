// Permutas › Terrenos › Cadastros: lista das permutas de área (KPIs, filtros, tabela) e a modal de cadastro.
// Not generated from the prototype. Dados: store.ts (lib/permutas.ts; tabelas app_permutas*, negocios_permuta).
// Logic (menu, rota, permissão): logic/vals/permutas.ts.
import { useMemo, useState } from 'react';
import './permutas.css';
import { calcular, m2, pct, type Permuta } from '../../lib/permutas';
import { FiltroBusca, Paginacao, useColunas, usePaginacao, exportarExcel, IcExcel, type Coluna } from './ui';
import { useBasePermutas, Kpi, ModalPermutaStore, dataBr, semAcento } from './comum';

const COLUNAS: Coluna[] = [
  { key: 'origem', label: 'Área / empreendimento', w: 240, min: 120 },
  { key: 'perm', label: 'Permutante', w: 200, min: 100 },
  { key: 'nmat', label: 'Nº matrícula', w: 100 },
  { key: 'mat', label: 'Matrícula (m²)', w: 120, num: true },
  { key: 'coef', label: 'Coef.', w: 70, num: true },
  { key: 'pct', label: '% permuta', w: 90, num: true },
  { key: 'area', label: 'Área permuta', w: 120, num: true },
  { key: 'div', label: 'Emp. diversos', w: 120, num: true },
  { key: 'un', label: 'Unidades', w: 280, min: 120 },
];

const POR_PAGINA = [30, 60, 100] as const;

export default function PermutasCadastroPage({ v }: { v: any }) {
  const { ctx, ativo, dados, empresas, nomeOrigem, nomeEmp, empDaOrigem } = useBasePermutas(v, 'cadastros');
  const { permutas, negocios, carregado, erro } = dados;
  const [busca, setBusca] = useState('');
  const [fOrigem, setFOrigem] = useState('');
  const [soPend, setSoPend] = useState(false);
  const [modal, setModal] = useState<{ p: Permuta | null } | null>(null);
  const cols = useColunas('cadastros', COLUNAS);
  const empNome = (u: { enterprise_id: number }) => nomeEmp(u.enterprise_id);

  const linhas = useMemo(() => {
    const q = semAcento(busca.trim());
    return permutas
      .map(p => ({ p, c: calcular(p), origem: nomeOrigem(p), emp: empDaOrigem(p) }))
      .filter(({ p, c, origem, emp }) => {
        if (fOrigem && (p.empresa_id != null ? 's' + p.empresa_id : 'n' + p.negocio_id) !== fOrigem) return false;
        if (soPend && !(p.pendencia || c.area == null || (c.div != null && c.div < 0))) return false;
        if (q && !semAcento([origem, emp, p.permutante, p.num_matricula, p.observacao, p.pendencia, ...p.unidades.map(u => u.unidade_nome)].join(' ')).includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.origem.localeCompare(b.origem) || a.p.permutante.localeCompare(b.p.permutante));
  }, [permutas, busca, fOrigem, soPend, empresas, negocios, dados.catalogo]);

  const pg = usePaginacao(linhas, POR_PAGINA, [busca, fOrigem, soPend]);
  const soma = (f: (x: (typeof linhas)[number]) => number | null) => linhas.reduce((s, x) => s + (f(x) || 0), 0);
  const tMat = soma(x => x.p.area_matricula), tProprio = soma(x => (x.c.area != null ? x.c.proprio : 0)), tArea = soma(x => x.c.area), tDiv = soma(x => x.c.div), tAprov = soma(x => x.c.aprov);
  const nPend = linhas.filter(x => x.p.pendencia || x.c.area == null || (x.c.div != null && x.c.div < 0)).length;
  const base = linhas.filter(x => x.c.fonte === 'calc' && x.c.area != null);
  const pctMedio = base.reduce((s, x) => s + (x.c.aprov || 0), 0) ? base.reduce((s, x) => s + (x.c.area || 0), 0) / base.reduce((s, x) => s + (x.c.aprov || 0), 0) : null;
  const origens = useMemo(() => {
    const m = new Map<string, string>();
    permutas.forEach(p => {
      const emp = empDaOrigem(p);
      m.set(p.empresa_id != null ? 's' + p.empresa_id : 'n' + p.negocio_id, emp ? `${nomeOrigem(p)} – ${emp}` : nomeOrigem(p));
    });
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [permutas, empresas, negocios, dados.catalogo]);

  const exportar = () => {
    const r4 = (v: number | null) => (v == null ? null : +v.toFixed(4));
    exportarExcel('permutas-terrenos-cadastros.xlsx', 'Cadastros',
      ['Área / empreendimento', 'Origem', 'Permutante', 'Nº matrícula', 'Data do contrato', 'Área matrícula (m²)', 'Coeficiente', 'Aproveitamento (m²)', '% permuta',
        'Área de permuta (m²)', 'Próprio empreendimento (m²)', 'Empreendimentos diversos (m²)', 'Unidades', 'Documentos', 'Observação', 'Pendência'],
      linhas.map(({ p, c, origem, emp }) => [
        emp ? `${origem} – ${emp}` : origem, p.empresa_id != null ? `Sienge ${p.empresa_id}` : 'Negócio', p.permutante, p.num_matricula, dataBr(p.data_contrato),
        p.area_matricula, p.coeficiente, r4(c.aprov), p.pct_permuta == null ? null : +(p.pct_permuta * 100).toFixed(6),
        r4(c.area), p.area_propria, r4(c.div),
        p.unidades.map(u => `${empNome(u)} ${u.unidade_nome}${u.area_privativa != null ? ` (${m2(u.area_privativa)} m²)` : ''}`).join(' | '),
        p.anexos.map(a => (a.tipo === 'Outro' ? a.descricao : a.tipo)).join(' | '), p.observacao, p.pendencia,
      ])).catch(e => ctx?.toast('Não foi possível gerar a planilha: ' + (e?.message || e)));
  };

  if (!ativo || !ctx) return null;
  const podeEditar = ctx.podeEditar();

  return (
    <main className="pm-main">
      <div className="pm-head">
        <div>
          <div className="t">Cadastro de permutas</div>
          <div className="s">Áreas recebidas em permuta e as unidades dadas em troca, no próprio empreendimento ou em empreendimentos diversos.</div>
        </div>
        <div className="acts">
          <button type="button" className="pm-btn" onClick={() => ctx.ir('visao')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" /></svg>
            Visão Geral
          </button>
          <button type="button" className="pm-btn" onClick={exportar} disabled={!linhas.length}>
            <IcExcel />
            Exportar Excel
          </button>
          {podeEditar ? (
            <button type="button" className="pm-btn prim" onClick={() => setModal({ p: null })} disabled={!carregado}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" /></svg>
              Novo permutante
            </button>
          ) : null}
        </div>
      </div>

      {erro ? <div className="pm-err">Não foi possível carregar as permutas: {erro}</div> : null}

      <div className="pm-kpis">
        <Kpi fundo="var(--tint-blue)" rotulo="Área de matrícula" valor={m2(tMat)} un="m²" sub={`${linhas.length} registro${linhas.length === 1 ? '' : 's'} · ${new Set(linhas.map(x => x.p.permutante.trim().toUpperCase())).size} permutantes`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#4161FF" strokeWidth="1.7" /><path d="M4 12h16M12 4v16" stroke="#4161FF" strokeWidth="1.5" /></svg>} />
        <Kpi cor="#258B6C" fundo="var(--tint-green)" rotulo="Área de permuta" valor={m2(tArea)} un="m²" sub={`% médio ponderado ${pct(pctMedio)}`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5" stroke="#35AD88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
        <Kpi cor="#258B6C" fundo="var(--tint-green)" rotulo="No próprio empreendimento" valor={m2(tProprio)} un="m²" sub={tArea ? `${pct(tProprio / tArea)} da área de permuta` : '—'}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11" stroke="#35AD88" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 20v-5h6v5" stroke="#35AD88" strokeWidth="1.7" /></svg>} />
        <Kpi cor="#D97706" fundo="var(--tint-amber)" rotulo="Em empreend. diversos" valor={m2(tDiv)} un="m²" sub={tArea ? `${pct(tDiv / tArea)} da área de permuta` : '—'}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
        <Kpi cor="#D97706" fundo="var(--tint-amber)" rotulo="Pendências" valor={String(nPend)} sub="registros para revisar"
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#D97706" strokeWidth="1.6" /><path d="M12 8v5M12 16h.01" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" /></svg>} />
      </div>

      <div className="pm-filters">
        <div className="pm-f" style={{ flex: '0 1 300px' }}>
          <span className="pm-cap">Área / empreendimento</span>
          <FiltroBusca value={fOrigem} onChange={setFOrigem} placeholder="Buscar área ou empreendimento…"
            opcoes={origens.map(([k, n]) => ({ value: k, label: n, sub: k.startsWith('n') ? 'Negócio' : `Sienge ${k.slice(1)}` }))} />
        </div>
        <label className="pm-f" style={{ flex: '1 1 240px' }}>
          <span className="pm-cap">Buscar</span>
          <input className="pm-in" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Permutante, matrícula, unidade…" />
        </label>
        <label className="pm-check"><input type="checkbox" checked={soPend} onChange={e => setSoPend(e.target.checked)} />Só com pendência</label>
      </div>

      <div className="pm-tbl">
        <div className="pm-tbl-in">
          {cols.cabecalho}
          {!carregado && !erro ? <div className="pm-empty">Carregando permutas…</div> : null}
          {carregado && !linhas.length ? (
            <div className="pm-empty"><b>{permutas.length ? 'Nenhuma permuta para este filtro.' : 'Nenhuma permuta cadastrada ainda.'}</b>{permutas.length ? 'Ajuste os filtros acima.' : podeEditar ? 'Use “Novo permutante” para incluir a primeira.' : ''}</div>
          ) : null}
          {pg.visiveis.map(({ p, c, origem, emp }) => (
            <div key={p.id} className="pm-tr row" style={cols.estilo} tabIndex={0} onClick={() => setModal({ p })} onKeyDown={e => { if (e.key === 'Enter') setModal({ p }); }}>
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                {p.empresa_id != null ? <span className="pm-code">{p.empresa_id}</span> : <span className="pm-tagn">Negócio</span>}
                <b className="pm-ell" style={{ fontWeight: 600, color: 'var(--text)' }} title={emp ? `${origem} – ${emp}` : origem}>
                  {origem}{emp ? <span style={{ fontWeight: 500, color: 'var(--text-3)' }}> – {emp}</span> : null}
                </b>
              </span>
              <span className="pm-ell">{p.permutante}</span>
              <span className="pm-ell">{p.num_matricula || "—"}</span>
              <span className="pm-n">{m2(p.area_matricula)}</span>
              <span className="pm-n">{p.coeficiente != null ? String(p.coeficiente).replace('.', ',') + 'x' : '—'}</span>
              <span className="pm-n">{pct(p.pct_permuta)}</span>
              <span className="pm-n pm-calc">{m2(c.area)}</span>
              <span className="pm-n pm-calc">{m2(c.div)}</span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span className="pm-ell" style={{ color: 'var(--text-3)' }}>{p.unidades.length ? p.unidades.map(u => `${empNome(u)} ${u.unidade_nome}`).join(', ') : '—'}</span>
                {p.pendencia || c.area == null || (c.div != null && c.div < 0) ? (
                  <span><span className="pm-chip warn"><i />{p.pendencia || (c.area == null ? 'Sem % ou área de permuta' : 'Próprio > área de permuta')}</span></span>
                ) : null}
              </span>
            </div>
          ))}
          {linhas.length ? (
            <div className="pm-tr tot" style={cols.estilo}>
              <span>Total{busca || fOrigem || soPend ? ' (filtrado)' : ''}</span><span /><span />
              <span className="pm-n">{m2(tMat)}</span><span /><span className="pm-n">{pct(pctMedio)}</span>
              <span className="pm-n">{m2(tArea)}</span><span className="pm-n">{m2(tDiv)}</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Aproveitamento total {m2(tAprov)} m²</span>
            </div>
          ) : null}
        </div>
        <Paginacao pg={pg} rotulo="permutas" />
      </div>

      {modal ? (
        <ModalPermutaStore permuta={modal.p} ctx={ctx} empresas={empresas} fechar={() => setModal(null)} />
      ) : null}
    </main>
  );
}
