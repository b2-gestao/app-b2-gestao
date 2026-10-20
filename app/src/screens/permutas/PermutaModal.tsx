// Permutas › Cadastro: modal "Novo permutante" / "Editar permutante".
// Resumo fixo no topo (quem é, área total e como ela se divide), cálculo em forma de equação
// (o que se digita × o que é calculado) e unidades e documentos em seções recolhíveis.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SeletorBusca } from './busca';
import {
  calcular, lerNumero, m2, paraCampo, tamanho, nomeEmpreendimento, MAX_ANEXO, TIPOS_ANEXO,
  type AnexoNovo, type Negocio, type Permuta, type PermutaAnexo, type PermutaDados, type PermutaUnidade, type TipoAnexo, type UnidadeCatalogo,
} from '../../lib/permutas';

export interface EmpresaOpcao { id: number; nome: string; emp: string | null }
type Origem = { k: 's'; id: number } | { k: 'n'; id: string } | null;
type Linha = { enterprise_id: number | ''; unidade_id: number | ''; valor_unidade: number | null };
type Fila = AnexoNovo & { chave: number; erro?: string };

export interface PermutaModalProps {
  permuta: Permuta | null;
  empresas: EmpresaOpcao[];
  negocios: Negocio[];
  catalogo: UnidadeCatalogo[];
  podeEditar: boolean;
  toast: (m: string) => void;
  criarNegocio: (nome: string) => Promise<Negocio>;
  renomearNegocio: (id: string, nome: string) => Promise<void>;
  salvar: (id: string | null, dados: PermutaDados, unidades: PermutaUnidade[], novos: AnexoNovo[], removidos: PermutaAnexo[]) => Promise<void>;
  excluir: (p: Permuta) => Promise<void>;
  baixar: (a: PermutaAnexo) => Promise<void>;
  fechar: () => void;
}

const Chev = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IcX = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
);
const IcPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const iniciais = (n: string) => {
  const p = n.trim().split(/\s+/).filter(w => w.length > 2);
  if (!p.length) return '';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
const tipoArquivo = (n: string): [string, string] => {
  const e = (n.split('.').pop() || '').toLowerCase();
  if (e === 'pdf') return ['pdf', 'PDF'];
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(e)) return ['img', e.toUpperCase().slice(0, 4)];
  if (['xls', 'xlsx', 'csv'].includes(e)) return ['xls', e.toUpperCase()];
  return ['doc', (e || 'ARQ').toUpperCase().slice(0, 4)];
};
const dataBr = (iso: string) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return d && m && y ? `${d}/${m}/${y}` : ''; };

/** Número que "corre" até o valor novo (respeita prefers-reduced-motion). */
function useTween(alvo: number | null) {
  const [v, setV] = useState<number | null>(alvo);
  const atual = useRef<number | null>(alvo);
  useEffect(() => {
    if (alvo == null || atual.current == null || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      atual.current = alvo; setV(alvo); return;
    }
    const de = atual.current, t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / 500), e = 1 - Math.pow(1 - k, 3);
      const x = de + (alvo - de) * e;
      atual.current = x; setV(x);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return v;
}

export default function PermutaModal(p: PermutaModalProps) {
  const ed = p.permuta;
  const ro = !p.podeEditar;
  const [origem, setOrigem] = useState<Origem>(ed ? (ed.empresa_id != null ? { k: 's', id: ed.empresa_id } : { k: 'n', id: ed.negocio_id! }) : null);
  const [perm, setPerm] = useState(ed?.permutante || '');
  const [nmat, setNmat] = useState(ed?.num_matricula || '');
  const [dataCt, setDataCt] = useState(ed?.data_contrato?.slice(0, 10) || '');
  const [mat, setMat] = useState(paraCampo(ed?.area_matricula));
  const [coef, setCoef] = useState(paraCampo(ed?.coeficiente));
  const [pctTxt, setPctTxt] = useState(ed?.pct_permuta != null ? paraCampo(ed.pct_permuta * 100, 6) : '');
  const [own, setOwn] = useState(paraCampo(ed?.area_propria));
  const [inf, setInf] = useState(paraCampo(ed?.area_informada));
  const [obs, setObs] = useState(ed?.observacao || '');
  const [pend, setPend] = useState(ed?.pendencia || '');
  const [linhas, setLinhas] = useState<Linha[]>((ed?.unidades || []).map(u => ({ enterprise_id: u.enterprise_id, unidade_id: u.unidade_id, valor_unidade: u.valor_unidade })));
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [fila, setFila] = useState<Fila[]>([]);
  const [csU, setCsU] = useState(!ed);
  const [csA, setCsA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [confirmaAnexo, setConfirmaAnexo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const chaveFila = useRef(0);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) p.fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [salvando]);

  const c = calcular({ area_matricula: lerNumero(mat), coeficiente: lerNumero(coef), pct_permuta: (v => (v == null ? null : v / 100))(lerNumero(pctTxt)), area_propria: lerNumero(own), area_informada: lerNumero(inf) });
  const areaAnim = useTween(c.area);

  // catálogo: empreendimentos e unidades
  const porEmp = useMemo(() => {
    const m = new Map<number, { nome: string; company: number | null; unidades: UnidadeCatalogo[] }>();
    for (const u of p.catalogo) {
      if (!m.has(u.enterprise_id)) m.set(u.enterprise_id, { nome: nomeEmpreendimento(u), company: u.company_id, unidades: [] });
      m.get(u.enterprise_id)!.unidades.push(u);
    }
    return m;
  }, [p.catalogo]);
  const unidadePorId = useMemo(() => new Map(p.catalogo.map(u => [u.unidade_id, u])), [p.catalogo]);
  const proprios = origem?.k === 's' ? [...porEmp].filter(([, e]) => e.company === origem.id).map(([id]) => id) : [];
  const soProprio = c.div === 0;
  // Próprios primeiro, depois os com nome no de-para, por fim os "Empreendimento <código>".
  const semNome = (id: number) => !p.catalogo.find(u => u.enterprise_id === id)?.empreendimento;
  const empOpcoes = [...porEmp].filter(([id]) => !soProprio || proprios.includes(id))
    .sort((a, b) => (+proprios.includes(b[0]) - +proprios.includes(a[0])) || (+semNome(a[0]) - +semNome(b[0])) || a[1].nome.localeCompare(b[1].nome));
  const usadas = new Set(linhas.map(l => l.unidade_id).filter(Boolean));
  const areaDe = (l: Linha) => (l.unidade_id ? unidadePorId.get(l.unidade_id)?.area_privativa ?? null : null);
  const completas = linhas.filter(l => l.enterprise_id && l.unidade_id);
  const somaOwn = completas.filter(l => proprios.includes(l.enterprise_id as number)).reduce((s, l) => s + (areaDe(l) || 0), 0);
  const somaDiv = completas.filter(l => !proprios.includes(l.enterprise_id as number)).reduce((s, l) => s + (areaDe(l) || 0), 0);
  const tom = (x: number, alvo: number | null) => (alvo == null ? 'info' : Math.abs(x - alvo) < 0.01 ? 'ok' : x > alvo ? 'err' : 'warn');

  const empresa = origem?.k === 's' ? p.empresas.find(e => e.id === origem.id) : null;
  const negocio = origem?.k === 'n' ? p.negocios.find(n => n.id === origem.id) : null;
  const origemNome = empresa ? empresa.nome : negocio ? negocio.nome : '';
  const anexos = (ed?.anexos || []).filter(a => !removidos.includes(a.id));

  const tot = c.area || 0;
  const pOwn = tot > 0 ? Math.min(100, (c.proprio / tot) * 100) : 0;
  const pDiv = tot > 0 && (c.div || 0) > 0 ? Math.min(100 - pOwn, ((c.div || 0) / tot) * 100) : 0;

  const addArquivos = (files: File[]) => {
    const grandes = files.filter(f => f.size > MAX_ANEXO).map(f => f.name);
    if (grandes.length) p.toast(`Acima de 50 MB, não incluído: ${grandes.join(', ')}`);
    const ok = files.filter(f => f.size <= MAX_ANEXO).map(f => ({ file: f, tipo: '' as const, descricao: '', chave: ++chaveFila.current }));
    if (ok.length) { setFila(fi => [...fi, ...ok]); setCsA(true); }
  };

  const salvar = async () => {
    setErro('');
    if (!origem) { setErro('Selecione a área / empreendimento.'); return; }
    if (!perm.trim()) { setErro('Informe o nome do permutante.'); return; }
    let filaOk = true;
    const nf = fila.map(f => {
      const e = !f.tipo ? 'Escolha do que se trata.' : f.tipo === 'Outro' && !f.descricao.trim() ? 'Em Outro, descreva o documento.' : '';
      if (e) filaOk = false;
      return { ...f, erro: e };
    });
    if (!filaOk) { setFila(nf); setCsA(true); setErro('Revise os documentos na fila.'); return; }
    if (c.div != null && c.div < 0) { setErro('A área no próprio empreendimento passa da área de permuta.'); return; }
    // Com Emp. diversos = 0 só valem unidades do próprio empreendimento (regra do painel original).
    const validas = completas.filter(l => c.div !== 0 || proprios.includes(l.enterprise_id as number));
    const unidades: PermutaUnidade[] = validas.map(l => {
      const u = unidadePorId.get(l.unidade_id as number)!;
      return { enterprise_id: u.enterprise_id, unidade_id: u.unidade_id, unidade_nome: u.unidade, area_privativa: u.area_privativa, valor_unidade: l.valor_unidade };
    });
    const pctNum = lerNumero(pctTxt);
    const dados: PermutaDados = {
      empresa_id: origem.k === 's' ? origem.id : null, negocio_id: origem.k === 'n' ? origem.id : null,
      permutante: perm.trim(), num_matricula: nmat.trim() || null, data_contrato: dataCt || null,
      area_matricula: lerNumero(mat), coeficiente: lerNumero(coef), pct_permuta: pctNum == null ? null : pctNum / 100,
      area_propria: lerNumero(own), area_informada: lerNumero(inf),
      observacao: obs.trim() || null, pendencia: pend.trim() || null,
    };
    setSalvando(true);
    try {
      await p.salvar(ed?.id || null, dados, unidades, fila.map(({ file, tipo, descricao }) => ({ file, tipo, descricao })), (ed?.anexos || []).filter(a => removidos.includes(a.id)));
      const fora = completas.length - validas.length;
      p.toast((ed ? 'Alterações salvas' : 'Permutante adicionado') + (fora ? ` · ${fora} unidade(s) fora da regra removida(s)` : ''));
      p.fechar();
    } catch (e: any) {
      setErro(e?.message || String(e));
    } finally {
      setSalvando(false);
    }
  };

  const nomeIni = iniciais(perm);
  let frase: ReactNode;
  if (c.area == null) frase = 'Preencha a área de matrícula, o coeficiente e o % de permuta para ver a área total.';
  else if (c.div != null && c.div < 0) frase = <>O próprio empreendimento (<b>{m2(c.proprio)} m²</b>) passa da área de permuta (<b>{m2(c.area)} m²</b>). Revise o valor informado.</>;
  else frase = (
    <>
      Dos <b>{m2(c.area)} m²</b> de permuta, <b>{m2(c.proprio)} m²</b> são pagos em unidades do próprio empreendimento e <b>{m2(c.div)} m²</b> em empreendimentos diversos
      {c.div === 0 ? ' (por isso só entram unidades do próprio empreendimento)' : ''}.
      {c.fonte === 'informada' ? <> A área de permuta foi <b>informada diretamente</b>.</> : null}
    </>
  );

  const campo = (id: string, rot: string, val: string, set: (v: string) => void, ph?: string, dica?: string) => (
    <div className="pm-f">
      <label className="pm-cap" htmlFor={id}>{rot}</label>
      <input id={id} className="pm-in" inputMode="decimal" value={val} placeholder={ph} disabled={ro} onChange={e => set(e.target.value)} />
      {dica ? <span className="pm-hint">{dica}</span> : null}
    </div>
  );

  return (
    <div className="pm-ov" onMouseDown={e => { if (e.target === e.currentTarget && !salvando) p.fechar(); }}>
      <div className="pm-modal" role="dialog" aria-modal="true" aria-labelledby="pm-mt">
        <div className="pm-mh">
          <div className="pm-mic">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div className="pm-mt" id="pm-mt">{ed ? 'Editar permutante' : 'Novo permutante'}</div>
            <div className="pm-ms">Área permutada, unidades dadas em troca e documentos.</div>
          </div>
          <button type="button" className="pm-x" title="Fechar" onClick={p.fechar} disabled={salvando}><IcX /></button>
        </div>

        <div className="pm-mb">
          <div className="pm-sum">
            <div className="pm-sum-id">
              <div key={nomeIni} className={'pm-mono' + (nomeIni ? '' : ' vazio')}>{nomeIni || '—'}</div>
              <div style={{ minWidth: 0 }}>
                <div className={'pm-sum-n pm-ell' + (perm.trim() ? '' : ' vazio')}>{perm.trim() || 'Nome do permutante'}</div>
                <div className="pm-sum-o pm-ell">
                  {origemNome ? `${origemNome} · ${origem?.k === 's' ? 'Sienge ' + origem.id : 'Negócio'}` : 'Área / empreendimento'}
                  {nmat.trim() ? ` · Matr. ${nmat.trim()}` : ''}
                </div>
              </div>
            </div>
            <div className="pm-sum-tot">
              <div className="l1"><span className="pm-cap">Área de permuta</span><b>{areaAnim == null ? '—' : m2(areaAnim)}<em>m²</em></b></div>
              <div className="pm-cbar"><i className="o" style={{ width: pOwn + '%' }} /><i className="d" style={{ width: pDiv + '%' }} /></div>
              <div className="pm-cleg"><em>Próprio <b>{m2(c.proprio)}</b></em><em className="d">Diversos <b>{c.div == null ? '—' : m2(c.div)}</b></em></div>
            </div>
          </div>

          <div className="pm-g2">
            <div className="pm-f pm-full">
              <span className="pm-cap">Nome da área / empreendimento <span className="pm-req">*</span></span>
              <SeletorOrigem origem={origem} setOrigem={setOrigem} empresas={p.empresas} negocios={p.negocios} disabled={ro}
                criarNegocio={p.criarNegocio} renomearNegocio={p.renomearNegocio} toast={p.toast} />
            </div>
            <div className="pm-f pm-full">
              <label className="pm-cap" htmlFor="pm-perm">Permutante / vendedor <span className="pm-req">*</span></label>
              <input id="pm-perm" className="pm-in" value={perm} disabled={ro} placeholder="Nome completo" onChange={e => setPerm(e.target.value)} />
            </div>
            <div className="pm-f">
              <label className="pm-cap" htmlFor="pm-nmat">Nº da matrícula</label>
              <input id="pm-nmat" className="pm-in" value={nmat} disabled={ro} placeholder="Ex.: 123.456" onChange={e => setNmat(e.target.value)} />
            </div>
            <div className="pm-f">
              <label className="pm-cap" htmlFor="pm-dtc">Data do contrato</label>
              <input id="pm-dtc" type="date" className="pm-in" value={dataCt} disabled={ro} onChange={e => setDataCt(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="pm-g3">
              {campo('pm-mat', 'Área de matrícula (m²)', mat, setMat)}
              {campo('pm-coef', 'Coeficiente de aproveitamento (×)', coef, setCoef, 'Ex.: 1, 2, 5', 'Aproveitamento = área de matrícula × coeficiente.')}
              {campo('pm-pct', '% permuta', pctTxt, setPctTxt, 'Ex.: 12 ou 11,16', 'Digite em percentual (12 = 12%).')}
            </div>
            <div className="pm-g2">
              {campo('pm-own', 'Permuta no próprio empreendimento (m²)', own, setOwn)}
              {campo('pm-inf', 'Área de permuta informada (m²)', inf, setInf, '', 'Só vale se faltar matrícula, coeficiente ou %.')}
            </div>
            <div className="pm-res">
              <div className="pm-res-g">
                <div><span>Aproveitamento</span><b>{c.aprov == null ? '—' : m2(c.aprov) + ' m²'}</b></div>
                <div><span>Área de permuta</span><b>{c.area == null ? '—' : m2(c.area) + ' m²'}</b></div>
                <div><span>Emp. diversos</span><b>{c.div == null ? '—' : m2(c.div) + ' m²'}</b></div>
              </div>
              <div className="pm-cbar"><i className="o" style={{ width: pOwn + '%' }} /><i className="d" style={{ width: pDiv + '%' }} /></div>
              <div className={'pm-say' + (c.div != null && c.div < 0 ? ' err' : '')}>{frase}</div>
            </div>
          </div>

          {/* Unidades */}
          <div className={'pm-cs' + (csU ? ' open' : '')}>
            <button type="button" className="pm-cs-h" aria-expanded={csU} onClick={() => setCsU(!csU)}>
              <span className="t">Unidades / empreendimentos</span>
              <span className="n">{completas.length}</span>
              <span className="s">{completas.length ? `Próprio ${m2(somaOwn)} de ${m2(c.proprio)} m² · Diversos ${m2(somaDiv)} de ${c.div == null ? '—' : m2(c.div)} m²` : 'Nenhuma unidade vinculada'}</span>
              <Chev />
            </button>
            {csU ? (
              <div className="pm-cs-b">
                {soProprio ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                    <span className="pm-chip warn"><i />Emp. diversos = 0</span>Só dá para vincular unidades do próprio empreendimento.
                  </div>
                ) : null}
                {linhas.length ? (
                  <>
                    <div className="pm-u-hd">
                      <span className="pm-cap">Empreendimento</span><span className="pm-cap">Unidade</span>
                      <span className="pm-cap" style={{ textAlign: 'right' }}>Área privativa</span>
                      <span className="pm-cap">Valor da unidade<span className="pm-tagdef">a definir</span></span><span />
                    </div>
                    {linhas.map((l, i) => {
                      const fora = soProprio && !!l.enterprise_id && !proprios.includes(l.enterprise_id as number);
                      const emp = l.enterprise_id ? porEmp.get(l.enterprise_id) : null;
                      const opts = l.enterprise_id && !empOpcoes.some(([id]) => id === l.enterprise_id) && emp ? [[l.enterprise_id, emp] as const, ...empOpcoes] : empOpcoes;
                      const a = areaDe(l);
                      const set = (patch: Partial<Linha>) => setLinhas(ls => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                      return (
                        <div key={i} className={'pm-u-r' + (fora ? ' fora' : '')}>
                          <SeletorBusca ariaLabel="Empreendimento" value={l.enterprise_id} disabled={ro} placeholder="Buscar empreendimento…"
                            onChange={id => set({ enterprise_id: id, unidade_id: '' })}
                            opcoes={opts.map(([id, e]) => ({ value: id, label: e.nome, sub: String(id), nota: proprios.includes(id) ? 'próprio' : undefined }))} />
                          <SeletorBusca ariaLabel="Unidade" value={l.unidade_id} disabled={ro || !l.enterprise_id} buscaNoDetalhe={false}
                            placeholder={l.enterprise_id ? 'Buscar unidade…' : '—'} vazio="Nenhuma unidade com esse nome."
                            onChange={id => set({ unidade_id: id })}
                            opcoes={[...(emp?.unidades || [])].sort((x, y) => x.unidade.localeCompare(y.unidade, 'pt-BR', { numeric: true })).map(u => {
                              const tomada = usadas.has(u.unidade_id) && u.unidade_id !== l.unidade_id;
                              return { value: u.unidade_id, label: u.unidade, sub: u.area_privativa != null ? m2(u.area_privativa) + ' m²' : undefined, nota: tomada ? 'já incluída' : undefined, disabled: tomada };
                            })} />
                          <div className={'pm-ro' + (a == null ? ' vazio' : '')} title="Área privativa da base de unidades">{a == null ? '— m²' : m2(a) + ' m²'}</div>
                          <div className="pm-money" title="Fonte do valor ainda a definir"><span>R$</span><input className="pm-in" disabled placeholder="a definir" aria-label="Valor da unidade" /></div>
                          {ro ? <span /> : <button type="button" className="pm-rm" aria-label="Remover unidade" onClick={() => setLinhas(ls => ls.filter((_, j) => j !== i))}><IcX s={13} /></button>}
                          {fora ? <span className="pm-chip err msg"><i />Fora da regra: será removida ao salvar</span> : null}
                        </div>
                      );
                    })}
                  </>
                ) : <div className="pm-vazio">Nenhuma unidade vinculada.</div>}
                <div className="pm-u-ft">
                  {ro ? <span /> : (
                    <button type="button" className="pm-btn sm" onClick={() => setLinhas(ls => [...ls, { enterprise_id: soProprio && proprios.length === 1 ? proprios[0] : '', unidade_id: '', valor_unidade: null }])}>
                      <IcPlus />Adicionar unidade
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span className={'pm-chip ' + tom(somaOwn, c.proprio)}><i />Próprio {m2(somaOwn)} de {m2(c.proprio)} m²</span>
                    <span className={'pm-chip ' + tom(somaDiv, c.div)}><i />Diversos {m2(somaDiv)} de {c.div == null ? '—' : m2(c.div)} m²</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Documentos */}
          <div className={'pm-cs' + (csA ? ' open' : '')}>
            <button type="button" className="pm-cs-h" aria-expanded={csA} onClick={() => setCsA(!csA)}>
              <span className="t">Documentos</span>
              <span className="n">{anexos.length + fila.length}</span>
              <span className="s">
                {anexos.length || fila.length
                  ? [...anexos.map(a => (a.tipo === 'Outro' ? a.descricao : a.tipo)), ...(fila.length ? [`${fila.length} na fila`] : [])].join(' · ')
                  : 'Nenhum documento anexado'}
              </span>
              <Chev />
            </button>
            {csA ? (
              <div className="pm-cs-b">
                {ro ? null : (
                  <label className={'pm-drop' + (arrastando ? ' over' : '')}
                    onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
                    onDrop={e => { e.preventDefault(); setArrastando(false); addArquivos([...e.dataTransfer.files]); }}>
                    <div className="ic">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0l-4.5 4.5M12 4l4.5 4.5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <div><b>Arraste os arquivos aqui ou clique para escolher</b><div className="pm-hint">Até 50 MB por arquivo · vários de uma vez · enviados ao salvar</div></div>
                    <input type="file" multiple hidden onChange={e => { addArquivos([...(e.target.files || [])]); e.target.value = ''; }} />
                  </label>
                )}
                {fila.map((f, i) => {
                  const [cls, lab] = tipoArquivo(f.file.name);
                  const set = (patch: Partial<Fila>) => setFila(fi => fi.map((x, j) => (j === i ? { ...x, ...patch, erro: '' } : x)));
                  return (
                    <div key={f.chave} className="pm-st">
                      <div className={'pm-fi ' + cls}>{lab}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pm-nm1" title={f.file.name}>{f.file.name}</div>
                        <div className="pm-meta">{tamanho(f.file.size)} · na fila</div>
                      </div>
                      <div className="pm-f">
                        <select className={'pm-in' + (f.erro && !f.tipo ? ' bad' : '')} style={{ height: '32px', fontSize: '12.5px' }} value={f.tipo} aria-label="Do que se trata"
                          onChange={e => set({ tipo: e.target.value as TipoAnexo })}>
                          <option value="">Do que se trata?</option>
                          {TIPOS_ANEXO.map(t => <option key={t}>{t}</option>)}
                        </select>
                        {f.tipo === 'Outro' ? (
                          <input autoFocus className={'pm-in' + (f.erro && !f.descricao.trim() ? ' bad' : '')} style={{ height: '32px', fontSize: '12.5px' }}
                            placeholder="Descreva o documento *" value={f.descricao} onChange={e => set({ descricao: e.target.value })} />
                        ) : null}
                        {f.erro ? <span className="pm-errtxt">{f.erro}</span> : null}
                      </div>
                      <button type="button" className="pm-ib del" aria-label="Tirar da fila" onClick={() => setFila(fi => fi.filter((_, j) => j !== i))}><IcX s={13} /></button>
                    </div>
                  );
                })}
                {anexos.map(a => {
                  const [cls, lab] = tipoArquivo(a.nome);
                  return (
                    <div key={a.id} className="pm-ax">
                      <div className={'pm-fi ' + cls}>{lab}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pm-nm1" title={a.nome}>{a.nome}</div>
                        <div className="pm-meta">{a.tipo === 'Outro' ? a.descricao : a.tipo} · {tamanho(a.tamanho)} · {dataBr(a.adicionado_em)}</div>
                      </div>
                      {confirmaAnexo === a.id ? (
                        <span className="pm-confirm">Remover ao salvar?
                          <button type="button" className="pm-btn sm danger" onClick={() => { setRemovidos(r => [...r, a.id]); setConfirmaAnexo(null); }}>Sim</button>
                          <button type="button" className="pm-btn sm" onClick={() => setConfirmaAnexo(null)}>Não</button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span className="pm-chip info">{a.tipo}</span>
                          <button type="button" className="pm-ib" title="Baixar" aria-label={`Baixar ${a.nome}`} onClick={() => p.baixar(a)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          {ro ? null : (
                            <button type="button" className="pm-ib del" title="Remover" aria-label={`Remover ${a.nome}`} onClick={() => setConfirmaAnexo(a.id)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
                {!anexos.length && !fila.length && ro ? <div className="pm-vazio">Nenhum documento anexado.</div> : null}
              </div>
            ) : null}
          </div>

          <div className="pm-g2">
            <div className="pm-f pm-full">
              <label className="pm-cap" htmlFor="pm-obs">Observação</label>
              <textarea id="pm-obs" className="pm-in" value={obs} disabled={ro} onChange={e => setObs(e.target.value)} />
            </div>
            <div className="pm-f pm-full">
              <label className="pm-cap" htmlFor="pm-pend">Pendência (aparece como alerta)</label>
              <input id="pm-pend" className="pm-in" value={pend} disabled={ro} placeholder="Ex.: confirmar m² com o comercial" onChange={e => setPend(e.target.value)} />
            </div>
          </div>

          {erro ? (
            <div className="pm-err">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', marginTop: '1px' }}><circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" /><path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              {erro}
            </div>
          ) : null}
        </div>

        <div className="pm-mf">
          {ed && !ro ? (
            confirmaExcluir ? (
              <span className="pm-confirm">Excluir {ed.permutante} e os documentos?
                <button type="button" className="pm-btn sm danger" disabled={salvando}
                  onClick={async () => { setSalvando(true); try { await p.excluir(ed); p.toast('Permutante excluído'); p.fechar(); } catch (e: any) { setErro(e?.message || String(e)); setSalvando(false); } }}>
                  Sim, excluir
                </button>
                <button type="button" className="pm-btn sm" onClick={() => setConfirmaExcluir(false)}>Não</button>
              </span>
            ) : (
              <button type="button" className="pm-btn danger" onClick={() => setConfirmaExcluir(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Excluir
              </button>
            )
          ) : null}
          <div className="r">
            <button type="button" className="pm-btn" onClick={p.fechar} disabled={salvando}>{ro ? 'Fechar' : 'Cancelar'}</button>
            {ro ? null : (
              <button type="button" className="pm-btn prim" onClick={salvar} disabled={salvando}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {salvando ? (fila.length ? 'Enviando documentos…' : 'Salvando…') : 'Salvar permutante'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Empresas do Sienge + negocios_permuta, com busca, "Cadastrar novo" e renomear com dois cliques. */
function SeletorOrigem(p: {
  origem: Origem; setOrigem: (o: Origem) => void; empresas: EmpresaOpcao[]; negocios: Negocio[]; disabled: boolean;
  criarNegocio: (nome: string) => Promise<Negocio>; renomearNegocio: (id: string, nome: string) => Promise<void>; toast: (m: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEd, setNomeEd] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const clique = useRef<number>(0);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) { setAberto(false); setCriando(false); setEditando(null); } };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const termo = semAcento(q.trim());
  const bate = (t: string) => !termo || semAcento(t).includes(termo);
  const es = p.empresas.filter(e => bate(`${e.nome} ${e.emp || ''} ${e.id}`));
  const ns = p.negocios.filter(n => bate(n.nome));
  const emp = p.origem?.k === 's' ? p.empresas.find(e => e.id === (p.origem as any).id) : null;
  const neg = p.origem?.k === 'n' ? p.negocios.find(n => n.id === (p.origem as any).id) : null;

  const escolher = (o: Origem) => { p.setOrigem(o); setAberto(false); setQ(''); };
  const criar = async () => {
    const n = novo.trim();
    if (!n) { p.toast('Digite o nome do negócio.'); return; }
    if ([...p.negocios.map(x => x.nome), ...p.empresas.map(x => x.nome)].some(x => x.toLowerCase() === n.toLowerCase())) { p.toast('Já existe um item com esse nome.'); return; }
    setOcupado(true);
    try { const r = await p.criarNegocio(n); escolher({ k: 'n', id: r.id }); setCriando(false); setNovo(''); p.toast(`“${n}” cadastrado em negócios de permuta`); }
    catch (e: any) { p.toast(e?.message || String(e)); }
    finally { setOcupado(false); }
  };
  const renomear = async () => {
    const n = nomeEd.trim();
    if (!n || !editando) { p.toast('O nome não pode ficar vazio.'); return; }
    setOcupado(true);
    try { await p.renomearNegocio(editando, n); setEditando(null); p.toast('Nome do negócio atualizado'); }
    catch (e: any) { p.toast(e?.message || String(e)); }
    finally { setOcupado(false); }
  };

  return (
    <div className="pm-dd" ref={caixa}>
      <button type="button" className={'pm-dd-btn' + (aberto ? ' open' : '')} disabled={p.disabled} aria-haspopup="listbox" aria-expanded={aberto}
        onClick={() => { setAberto(!aberto); setCriando(false); setEditando(null); setQ(''); }}>
        <span className={'v' + (emp || neg ? '' : ' vazio')}>
          {emp ? <>{emp.nome}{emp.emp ? <span style={{ color: 'var(--text-4)' }}> – {emp.emp}</span> : null}</>
            : neg ? <>{neg.nome} <span className="pm-tagn" style={{ marginLeft: '6px' }}>Negócio</span></>
              : 'Selecione a empresa ou o negócio'}
        </span>
        <Chev />
      </button>
      {aberto ? (
        <div className="pm-dd-pan">
          <input className="pm-dd-q" autoFocus placeholder="Buscar empresa ou negócio..." value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); } }} />
          <div className="pm-dd-list" role="listbox">
            <div className="pm-dd-g"><span>Empresas do Sienge</span></div>
            {es.length ? es.map(e => (
              <div key={'s' + e.id} role="option" aria-selected={emp?.id === e.id} className={'pm-dd-i' + (emp?.id === e.id ? ' sel' : '')} onClick={() => escolher({ k: 's', id: e.id })}>
                <span className="nm">{e.nome}{e.emp ? <span className="sub"> – {e.emp}</span> : null}</span>
              </div>
            )) : <div className="pm-hint" style={{ padding: '6px 10px' }}>Nenhuma empresa encontrada.</div>}
            <div className="pm-dd-g"><span>Negócios de permuta</span><em>2 cliques para renomear</em></div>
            {ns.length ? ns.map(n => editando === n.id ? (
              <div key={n.id} className="pm-row-in" style={{ padding: '4px' }}>
                <input className="pm-in" autoFocus value={nomeEd} aria-label="Novo nome do negócio" onChange={e => setNomeEd(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renomear(); if (e.key === 'Escape') { e.stopPropagation(); setEditando(null); } }} />
                <button type="button" className="pm-btn sm" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="button" className="pm-btn sm prim" disabled={ocupado} onClick={renomear}>Salvar</button>
              </div>
            ) : (
              <div key={n.id} role="option" aria-selected={neg?.id === n.id} title="Clique duas vezes para renomear"
                className={'pm-dd-i' + (neg?.id === n.id ? ' sel' : '')}
                onClick={e => {
                  // um clique escolhe; dois cliques abrem a edição do nome
                  window.clearTimeout(clique.current);
                  if (e.detail >= 2) return;
                  clique.current = window.setTimeout(() => escolher({ k: 'n', id: n.id }), 230);
                }}
                onDoubleClick={() => { window.clearTimeout(clique.current); setEditando(n.id); setNomeEd(n.nome); }}>
                <span className="pm-tagn">Negócio</span>
                <span className="nm">{n.nome}</span>
                <span className="pen">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                </span>
              </div>
            )) : <div className="pm-hint" style={{ padding: '6px 10px' }}>Nenhum negócio encontrado.</div>}
          </div>
          <div className="pm-dd-f">
            {criando ? (
              <>
                <span className="pm-cap">Novo negócio / empreendimento</span>
                <div className="pm-row-in">
                  <input className="pm-in" autoFocus placeholder="Ex.: Área Chácara São José" value={novo} onChange={e => setNovo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') criar(); if (e.key === 'Escape') { e.stopPropagation(); setCriando(false); } }} />
                  <button type="button" className="pm-btn sm" onClick={() => setCriando(false)}>Cancelar</button>
                  <button type="button" className="pm-btn sm prim" disabled={ocupado} onClick={criar}>Cadastrar</button>
                </div>
              </>
            ) : (
              <button type="button" className="pm-btn sm dashed" onClick={() => setCriando(true)}><IcPlus />Cadastrar novo negócio / empreendimento</button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
