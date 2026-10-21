// Permutas › Terrenos › Insights: análise da IA no topo e dashboards da distribuição das permutas.
// Os números e alertas vêm de analise.ts (regras fixas); a IA (edge function app-ia, tela "permutas")
// recebe esses dados e devolve os pontos de atenção. Sem IA configurada, a tela mostra os alertas das regras.
import { useEffect, useMemo, useRef, useState } from 'react';
import './permutas.css';
import { m2 } from '../../lib/permutas';
import { apoioApi, type IaResposta } from '../../lib/api';
import { useBasePermutas, Kpi, dataBr } from './comum';
import { analisar, type Nivel } from './analise';
import { exportarExcel, IcExcel } from './ui';

const COR: Record<Nivel, { bg: string; fg: string; dot: string; nome: string }> = {
  critico: { bg: 'var(--tint-red)', fg: 'var(--tx-b91c1c)', dot: '#EF4444', nome: 'Crítico' },
  atencao: { bg: 'var(--tint-amber-2)', fg: 'var(--tx-92590a)', dot: '#F59E0B', nome: 'Atenção' },
  info: { bg: 'var(--tint-blue-2)', fg: 'var(--tx-3148b8)', dot: '#4161FF', nome: 'Info' },
  positivo: { bg: 'var(--tint-green-2)', fg: 'var(--tx-1f7a5c)', dot: '#43B997', nome: 'Positivo' },
};
const SITUACAO: Record<string, [string, string]> = {
  'sem-area': ['Sem área', 'err'], 'sem-unidade': ['Sem unidade', 'warn'], parcial: ['Parcial', 'warn'], ok: ['Fechado', 'ok'], excesso: ['Acima de 100%', 'err'],
};
/** Cards da "Análise da IA" ocultos por enquanto: volte para true para reexibir (e voltar a chamar a IA). */
const ANALISE_IA_VISIVEL = false;
const pctTxt = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export default function PermutasInsightsPage({ v }: { v: any }) {
  const { ctx, ativo, live, dados, nomeOrigem, nomeEmp } = useBasePermutas(v, 'insights');
  const { permutas, diretas, catalogo, carregado, erro } = dados;
  const a = useMemo(() => analisar(permutas, diretas, catalogo, nomeOrigem, nomeEmp), [permutas, diretas, catalogo, dados.negocios, nomeOrigem]);
  const [ia, setIa] = useState<{ estado: 'ocioso' | 'carregando' | 'ok' | 'erro'; r?: IaResposta; msg?: string }>({ estado: 'ocioso' });
  const [fTipo, setFTipo] = useState('');
  const pedido = useRef(0);

  const pedirIa = async () => {
    if (!live) { setIa({ estado: 'erro', msg: 'No modo demonstração a IA não é chamada. Abaixo, os pontos calculados pelas regras do app.' }); return; }
    const n = ++pedido.current;
    setIa({ estado: 'carregando' });
    try {
      const regras = a.alertas.slice(0, 40).map(x => ({ label: x.label, text: `${x.text} Causa provável: ${x.causa} Próximo passo: ${x.passo}` }));
      const r = await apoioApi.ia('permutas', a.contexto, regras);
      if (n === pedido.current) setIa({ estado: 'ok', r });
    } catch (e: any) {
      if (n === pedido.current) setIa({ estado: 'erro', msg: e?.status === 503 ? 'A IA não está configurada no servidor. Abaixo, os pontos calculados pelas regras do app.' : `Não foi possível falar com a IA (${e?.message || e}). Abaixo, os pontos calculados pelas regras do app.` });
    }
  };
  useEffect(() => { if (ANALISE_IA_VISIVEL && ativo && carregado && ia.estado === 'ocioso') pedirIa(); }, [ativo, carregado]);

  if (!ativo || !ctx) return null;
  const tipos = [...new Set(a.alertas.map(x => x.tipo))];
  const alertas = a.alertas.filter(x => !fTipo || x.tipo === fTipo);
  const nCrit = a.alertas.filter(x => x.nivel === 'critico').length;
  const maxT = Math.max(1, ...a.porTerreno.map(t => t.proprio + t.div));
  const maxE = Math.max(1, ...a.porEmp.map(e => e.unidades));
  const regrasComoIa = a.alertas.slice(0, 6);
  const exportar = () => exportarExcel('permutas-insights.xlsx', 'Alertas', ['Nível', 'Tipo', 'Alerta', 'Detalhe', 'Causa provável', 'Próximo passo'],
    a.alertas.map(x => [COR[x.nivel].nome, x.tipo, x.label, x.text, x.causa, x.passo])).catch(e => ctx.toast('Não foi possível gerar a planilha: ' + (e?.message || e)));

  return (
    <main className="pm-main">
      <div className="pm-head">
        <div>
          <button type="button" className="pm-link" onClick={() => ctx.ir('visao')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Visão Geral
          </button>
          <div className="t">Insights</div>
          <div className="s">O que merece atenção nas permutas: concentração por terreno e empreendimento, alocação das unidades e qualidade dos dados.</div>
        </div>
        <div className="acts">
          <button type="button" className="pm-btn" onClick={exportar} disabled={!a.alertas.length}><IcExcel />Exportar alertas</button>
          {ANALISE_IA_VISIVEL ? (
            <button type="button" className="ia-cta" style={{ height: '38px', padding: '0 16px 0 13px', fontSize: '13px' }} onClick={pedirIa} disabled={ia.estado === 'carregando' || !carregado}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor" /></svg>
              {ia.estado === 'carregando' ? 'Analisando…' : 'Atualizar análise'}
            </button>
          ) : null}
        </div>
      </div>

      {erro ? <div className="pm-err">Não foi possível carregar: {erro}</div> : null}

      {/* Análise da IA */}
      {ANALISE_IA_VISIVEL ? (
      <section className="pm-ia">
        <div className="pm-ia-h">
          <span className="pm-ia-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" /></svg></span>
          <div style={{ minWidth: 0 }}>
            <b>Análise da IA</b>
            <span>{ia.estado === 'ok' && ia.r ? `${ia.r.modelo}${ia.r.cache ? ' · do cache' : ''}${ia.r.gerado_em ? ' · ' + new Date(ia.r.gerado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}` : 'Lê os cadastros, cruza unidades, áreas e datas de entrega e aponta o que fazer.'}</span>
          </div>
        </div>
        {ia.estado === 'carregando' || (!carregado && !erro) ? (
          <div className="pm-ia-load"><i /><i /><i /><span>A IA está lendo {permutas.length} permutas e {a.totais.unidades} unidades…</span></div>
        ) : ia.estado === 'ok' && ia.r ? (
          <>
            <div className="pm-ia-head">{ia.r.headline}</div>
            <div className="pm-ia-items">
              {ia.r.items.map((it, i) => (
                <div key={i} className="pm-ia-it" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="dot" style={{ background: COR[it.nivel].dot }} />
                  <div><b>{it.label}</b><p>{it.text}</p></div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {ia.msg ? <div className="pm-ia-aviso">{ia.msg}</div> : null}
            <div className="pm-ia-items">
              {regrasComoIa.length ? regrasComoIa.map((it, i) => (
                <div key={i} className="pm-ia-it" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="dot" style={{ background: COR[it.nivel].dot }} />
                  <div><b>{it.label}</b><p>{it.text} <span style={{ color: 'var(--text-3)' }}>Próximo passo: {it.passo}</span></p></div>
                </div>
              )) : <div className="pm-hint">Nenhum ponto de atenção encontrado pelas regras.</div>}
            </div>
          </>
        )}
      </section>
      ) : null}

      <div className="pm-kpis">
        <Kpi cor="#258B6C" fundo="var(--tint-green)" rotulo="Área de permuta" valor={m2(a.totais.tArea)} un="m²" sub={`${permutas.length} permutas · ${a.porTerreno.length} terrenos`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5" stroke="#35AD88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
        <Kpi cor="#7C3AED" fundo="var(--tint-purple)" rotulo="Em empreend. diversos" valor={pctTxt(a.totais.pctDiv)} sub={`${m2(a.totais.tDiv)} m² fora do próprio empreendimento`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11" stroke="#7C3AED" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 20v-5h6v5" stroke="#7C3AED" strokeWidth="1.7" /></svg>} />
        <Kpi fundo="var(--tint-blue)" rotulo="Alocado em unidades" valor={pctTxt(a.totais.tArea ? a.totais.tAloc / a.totais.tArea : null)} sub={`${m2(a.totais.tAloc)} de ${m2(a.totais.tArea)} m²`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="3.5" width="16" height="17" rx="2" stroke="#4161FF" strokeWidth="1.7" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2" stroke="#4161FF" strokeWidth="1.6" strokeLinecap="round" /></svg>} />
        <Kpi cor={nCrit ? '#DC2626' : '#258B6C'} fundo={nCrit ? 'var(--tint-red)' : 'var(--tint-green)'} rotulo="Alertas críticos" valor={String(nCrit)} sub={`${a.alertas.length} pontos de atenção no total`}
          icone={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 4l9 16H3z" stroke={nCrit ? '#EF4444' : '#35AD88'} strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke={nCrit ? '#EF4444' : '#35AD88'} strokeWidth="1.8" strokeLinecap="round" /></svg>} />
      </div>

      <div className="pm-dash">
        <section className="pm-panel">
          <div className="pm-panel-h"><div><b>Área de permuta por terreno</b><span>m² · próprio empreendimento × empreendimentos diversos</span></div>
            <div className="pm-leg rt"><em>Próprio</em><em className="d">Diversos</em></div></div>
          <div className="pm-bars">
            {a.porTerreno.slice(0, 12).map(t => (
              <div key={t.nome} className="pm-bar-row" title={`${t.nome}: próprio ${m2(t.proprio)} · diversos ${m2(t.div)} m²`}>
                <span className="nm pm-ell">{t.nome}</span>
                <span className="trk"><i className="o" style={{ width: (t.proprio / maxT) * 100 + '%' }} /><i className="d" style={{ width: (t.div / maxT) * 100 + '%' }} /></span>
                <span className="vl">{m2(t.area)}</span>
              </div>
            ))}
            {!a.porTerreno.length ? <div className="pm-hint">Sem permutas cadastradas.</div> : null}
          </div>
        </section>
        <section className="pm-panel">
          <div className="pm-panel-h"><div><b>Unidades por empreendimento</b><span>Onde as unidades permutadas estão (quantidade e m²)</span></div></div>
          <div className="pm-bars">
            {a.porEmp.slice(0, 12).map(e => (
              <div key={e.enterprise_id} className="pm-bar-row" title={`${e.nome}: ${e.unidades} unidades · ${m2(e.m2)} m² · ${e.permutantes.size} permutantes`}>
                <span className="nm pm-ell">{e.nome}</span>
                <span className="trk"><i className="u" style={{ width: (e.unidades / maxE) * 100 + '%' }} /></span>
                <span className="vl">{e.unidades} <small>· {m2(e.m2)} m²</small></span>
              </div>
            ))}
            {!a.porEmp.length ? <div className="pm-hint">Nenhuma unidade vinculada ainda.</div> : null}
          </div>
        </section>
      </div>

      <section className="pm-panel">
        <div className="pm-panel-h"><div><b>Alocação por permutante</b><span>Área de permuta contratada × soma das áreas privativas das unidades vinculadas</span></div></div>
        <div className="pm-tbl-in">
          <div className="pm-tr hd pm-aloc">
            <span>Permutante</span><span>Terreno</span><span className="pm-n">Permuta (m²)</span><span className="pm-n">Alocado (m²)</span><span>Alocação</span><span>Situação</span>
          </div>
          {[...a.aloc].sort((x, y) => (x.pct ?? -1) - (y.pct ?? -1)).map(x => {
            const [nome, tom] = SITUACAO[x.situacao];
            const p = Math.min(1.2, x.pct || 0);
            return (
              <div key={x.id} className="pm-tr pm-aloc">
                <b className="pm-ell" style={{ fontWeight: 600, color: 'var(--text)' }}>{x.permutante}</b>
                <span className="pm-ell" style={{ color: 'var(--text-3)' }}>{x.origem}</span>
                <span className="pm-n">{m2(x.area)}</span>
                <span className="pm-n">{m2(x.alocProprio + x.alocDiv)}</span>
                <span className="pm-prog"><span><i className={x.situacao === 'excesso' ? 'err' : x.situacao === 'ok' ? 'ok' : ''} style={{ width: Math.min(100, p * 100) + '%' }} /></span><em>{pctTxt(x.pct)}</em></span>
                <span><span className={'pm-chip ' + tom}><i />{nome}</span></span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pm-panel">
        <div className="pm-panel-h">
          <div><b>Qualidade e pendências</b><span>Cada alerta com a causa provável e o próximo passo</span></div>
          <div className="rt" style={{ display: 'flex', gap: '2px', background: 'var(--surface-3)', borderRadius: '8px', padding: '3px', flexWrap: 'wrap' }}>
            {['', ...tipos].map(t => (
              <button key={t || 'todos'} type="button" className={'pm-seg' + (fTipo === t ? ' on' : '')} onClick={() => setFTipo(t)}>
                {t || 'Todos'} <span>{t ? a.alertas.filter(x => x.tipo === t).length : a.alertas.length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pm-alertas">
          {alertas.map((x, i) => (
            <div key={i} className="pm-al">
              <span className="pm-al-n" style={{ background: COR[x.nivel].bg, color: COR[x.nivel].fg }}>{COR[x.nivel].nome}</span>
              <div className="pm-al-t"><b>{x.label}</b><p>{x.text}</p><span className="pm-cap" style={{ fontSize: '9.5px' }}>{x.tipo}</span></div>
              <div className="pm-al-c"><span className="pm-cap">Causa provável</span><p>{x.causa}</p></div>
              <div className="pm-al-c"><span className="pm-cap">Próximo passo</span><p>{x.passo}</p></div>
            </div>
          ))}
          {!alertas.length ? <div className="pm-empty"><b>Nada por aqui.</b>Nenhum alerta para este filtro.</div> : null}
        </div>
      </section>

      {a.entregas.length ? (
        <section className="pm-panel">
          <div className="pm-panel-h"><div><b>Entregas nos próximos 12 meses</b><span>Data de entrega das unidades no Sienge × permutantes ainda sem unidade definida no próprio empreendimento</span></div></div>
          <div className="pm-alertas">
            {a.entregas.sort((x, y) => x.dias - y.dias).map(e => (
              <div key={e.emp} className="pm-al" style={{ gridTemplateColumns: '90px minmax(0,1fr) minmax(0,1.4fr)' }}>
                <span className="pm-al-n" style={{ background: e.dias <= 120 ? 'var(--tint-red)' : 'var(--tint-blue-2)', color: e.dias <= 120 ? 'var(--tx-b91c1c)' : 'var(--tx-3148b8)' }}>{e.dias < 0 ? 'Entregue' : `${e.dias} dias`}</span>
                <div className="pm-al-t"><b>{e.emp}</b><p>Entrega {dataBr(e.data)}</p></div>
                <div className="pm-al-c"><span className="pm-cap">Sem unidade definida</span><p>{e.permutantes.length ? e.permutantes.join(', ') : 'Todos com unidade definida.'}</p></div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
