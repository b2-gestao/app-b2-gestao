// Notas Fiscais › Cadastros: histórico das notas cadastradas e o assistente de cadastro de nota
// de compra no Sienge (envio do PDF → pedido → conferência → cadastrada).
// Not generated from the prototype; follows the look of Categorias/BI. Logic: logic/vals/notasCadastros.ts.
import { useEffect, useRef, type ReactNode } from 'react';
import { css, hv } from '../dc/runtime';

const colHead = { fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 } as const;
const card = 'border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03),0 4px 16px rgba(0,0,0,.025)';
const anim = (ms: number) => `opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:${ms}ms`;
const input = 'height:38px;width:100%;padding:0 12px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s';
const btnPrim = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border:none;border-radius:9px;background:#4161FF;color:#FFFFFF;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(65,97,255,.26);transition:background .15s,transform .15s,box-shadow .15s';
const btnPrimHover = 'background:#3153F4;box-shadow:0 8px 20px rgba(65,97,255,.34)';
const btnSec = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 12px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#374151;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,transform .15s';
const btnSecHover = 'background:#F4F4F6;border-color:#D8D8E0';
const off = ';opacity:.5;cursor:default;box-shadow:none';
const link = 'border:none;background:none;padding:0;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer';

const TONS = {
  erro: { bg: '#FEE9E9', bd: '#FCA5A5', fg: '#B91C1C', dot: '#EF4444' },
  aviso: { bg: '#FFF7E8', bd: '#FAD59A', fg: '#92590A', dot: '#F59E0B' },
  info: { bg: '#F2F5FF', bd: '#D5DEFF', fg: '#3148B8', dot: '#4161FF' },
  ok: { bg: '#E9F8F2', bd: '#BDE8D8', fg: '#1F7A5C', dot: '#43B997' },
} as const;

function DocIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l4 4v14H6z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"></path>
      <path d="M15 3v4h4M9 12h7M9 16h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

function Spinner({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin .9s linear infinite', flex: 'none' }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity=".3" strokeWidth="2.4"></circle>
      <path d="M21 12a9 9 0 00-9-9" stroke={color} strokeWidth="2.4" strokeLinecap="round"></path>
    </svg>
  );
}

function Alerta({ tom, titulo, itens, children }: { tom: keyof typeof TONS; titulo: string; itens?: string[]; children?: ReactNode }) {
  const t = TONS[tom];
  return (
    <div style={{ padding: '12px 14px', borderRadius: '10px', background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, fontSize: '12.5px', lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: t.dot, flex: 'none' }}></span>
        {titulo}
      </div>
      {itens && itens.length ? (
        <ul style={{ margin: '6px 0 0', paddingLeft: '22px' }}>
          {itens.map(i => <li key={i}>{i}</li>)}
        </ul>
      ) : null}
      {children ? <div style={{ marginTop: '4px', paddingLeft: '15px' }}>{children}</div> : null}
    </div>
  );
}

function Secao({ titulo, sub, acoes, children, delay = 0 }: { titulo: string; sub?: string; acoes?: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <section style={css(`${card};padding:18px 20px;display:flex;flex-direction:column;gap:14px;${anim(delay)}`)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#111827' }}>{titulo}</div>
          {sub ? <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{sub}</div> : null}
        </div>
        {acoes ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{acoes}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, dica, largura = 1, children }: { rotulo: string; dica?: ReactNode; largura?: number; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: `span ${largura}`, minWidth: 0 }}>
      <span style={colHead}>{rotulo}</span>
      {children}
      {dica ? <span style={{ fontSize: '11.5px', color: '#94A3B8', lineHeight: 1.4 }}>{dica}</span> : null}
    </label>
  );
}

function Leitura({ valor, detalhe }: { valor: string; detalhe?: string }) {
  return (
    <div style={{ minHeight: '38px', padding: '8px 12px', borderRadius: '8px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1', fontSize: '13px', color: '#111827', fontWeight: 500 }}>
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={valor}>{valor}</div>
      {detalhe ? <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '1px' }}>{detalhe}</div> : null}
    </div>
  );
}

function Chip({ tom, children }: { tom: keyof typeof TONS; children: ReactNode }) {
  const t = TONS[tom];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '22px', padding: '0 9px', borderRadius: '20px', background: t.bg, color: t.fg, fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.dot }}></span>
      {children}
    </span>
  );
}

function Resumo({ itens }: { itens: [string, string, string?][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px' }}>
      {itens.map(([rot, val, det]) => (
        <div key={rot} style={{ padding: '10px 12px', borderRadius: '9px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1', minWidth: 0 }}>
          <div style={colHead}>{rot}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={val}>{val}</div>
          {det ? <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '1px' }}>{det}</div> : null}
        </div>
      ))}
    </div>
  );
}

const SIM = {
  alta: { bg: '#E9F8F2', fg: '#1F7A5C' },
  media: { bg: '#FFF7E8', fg: '#92590A' },
  baixa: { bg: '#FEE9E9', fg: '#B91C1C' },
  manual: { bg: '#F2F5FF', fg: '#3148B8' },
  vazio: { bg: 'transparent', fg: '#CBD5E1' },
} as const;

export default function NotasCadastrosPage({ v }: { v: any }) {
  const mainRef = useRef<HTMLElement>(null);
  const etapa = v.isNfCadastros ? v.nf.etapa : null;
  // Each step opens at the top (the previous one may have been scrolled down).
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [etapa]);

  if (!v.isNfCadastros) return null;
  const nf = v.nf;
  const lista = nf.etapa === 'lista';

  return (
    <main ref={mainRef} style={css('flex:1;min-height:0;overflow-y:auto;padding:24px 32px 32px;display:flex;flex-direction:column;gap:16px')}>
      <div style={css(`display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;${anim(0)}`)}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '20px', color: '#111827', letterSpacing: '-.01em' }}>
            {lista ? 'Notas cadastradas' : 'Cadastrar nota fiscal de compra'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
            {lista ? `${nf.totalLabel} · gravadas direto no Sienge` : 'Lê o PDF, confere com o pedido de compra no Sienge e grava só depois da sua confirmação.'}
          </div>
        </div>
        {lista ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={nf.recarregar} title="Recarregar o histórico" style={css(btnSec + ';height:38px')} className={hv(btnSecHover, 'transform:scale(.97)', undefined)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              Recarregar
            </button>
            {nf.podeEditar ? (
              <button onClick={nf.novo} style={css(btnPrim)} className={hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"></path>
                </svg>
                Cadastrar nota
              </button>
            ) : null}
          </div>
        ) : nf.etapa !== 'concluido' ? (
          <button onClick={nf.cancelar} disabled={nf.busy === 'cadastrar'} style={css(btnSec + ';height:38px' + (nf.busy === 'cadastrar' ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
            Cancelar
          </button>
        ) : null}
      </div>

      {!lista ? <Passos passos={nf.passos} /> : null}
      {lista ? <Historico nf={nf} /> : null}
      {nf.etapa === 'envio' ? <Envio nf={nf} /> : null}
      {nf.etapa === 'pedido' && nf.analise ? <Pedido nf={nf} /> : null}
      {nf.etapa === 'conferencia' && nf.conf ? <Conferencia nf={nf} c={nf.conf} /> : null}
      {nf.etapa === 'concluido' && nf.resultado ? <Concluido nf={nf} r={nf.resultado} /> : null}
    </main>
  );
}

function Passos({ passos }: { passos: any[] }) {
  return (
    <div style={css(`${card};display:flex;align-items:center;gap:6px;padding:12px 16px;flex-wrap:wrap;${anim(40)}`)}>
      {passos.map((p, i) => {
        const feito = p.estado === 'feito';
        const atual = p.estado === 'atual';
        return (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: i < passos.length - 1 ? '1 1 140px' : 'none' }}>
            <span style={{ width: '24px', height: '24px', flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', fontWeight: 700, background: feito ? '#43B997' : atual ? '#4161FF' : '#F1F1F4', color: feito || atual ? '#FFFFFF' : '#94A3B8', boxShadow: atual ? '0 0 0 4px rgba(65,97,255,.14)' : 'none', transition: 'all .2s' }}>
              {feito ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              ) : p.numero}
            </span>
            <span style={{ fontSize: '12.5px', fontWeight: atual ? 700 : 600, color: atual ? '#111827' : feito ? '#374151' : '#94A3B8', whiteSpace: 'nowrap' }}>{p.label}</span>
            {i < passos.length - 1 ? <span style={{ flex: 1, height: '1px', minWidth: '16px', margin: '0 6px', background: feito ? '#43B997' : '#EEEEF1' }}></span> : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------- histórico ----------

function Historico({ nf }: { nf: any }) {
  const grid = 'grid-template-columns:118px minmax(150px,1.2fr) minmax(170px,1.6fr) 92px 112px 110px 132px';
  return (
    <>
      <div style={css(`position:relative;display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;padding:14px 16px;${card};${anim(60)}`)}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 280px', minWidth: 0 }}>
          <span style={colHead}>Buscar</span>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: '11px', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="6.5" stroke="#A8B0BD" strokeWidth="1.8"></circle>
              <path d="M16 16l4.5 4.5" stroke="#A8B0BD" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
            <input value={nf.busca} onChange={nf.onBusca} placeholder="Número, fornecedor, empresa, pedido ou sequencial" style={css(input + ';height:36px;padding-left:33px')} />
          </span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={colHead}>Situação</span>
          <div style={{ display: 'flex', gap: '2px', background: '#F4F4F6', borderRadius: '8px', padding: '3px' }}>
            {nf.situacaoTabs.map((t: any) => (
              <button key={t.label} onClick={t.onClick} style={css(`border:none;border-radius:6px;padding:0 11px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${t.ativo ? '#111827' : 'transparent'};color:${t.ativo ? '#FFFFFF' : '#64748B'}`)}>{t.label}</button>
            ))}
          </div>
        </div>
        {nf.filtrado ? <button onClick={nf.limparFiltros} style={css(btnSec + ';color:#4161FF')}>Limpar filtros</button> : null}
      </div>

      <div style={css(`${card};overflow:hidden;${anim(110)}`)}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '980px' }}>
            <div style={css(`display:grid;${grid};gap:12px;align-items:center;padding:11px 18px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
              <div style={colHead}>Cadastro</div>
              <div style={colHead}>Documento</div>
              <div style={colHead}>Fornecedor · empresa</div>
              <div style={colHead}>Pedido</div>
              <div style={{ ...colHead, textAlign: 'right' }}>Valor</div>
              <div style={colHead}>Sienge</div>
              <div style={colHead}>Situação</div>
            </div>
            {nf.carregando ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '44px', fontSize: '12.5px', color: '#64748B' }}>
                <Spinner color="#4161FF" /> Carregando as notas cadastradas…
              </div>
            ) : null}
            {nf.historico.map((r: any, i: number) => {
              const aberto = nf.aberto === r.id;
              return (
                <div key={r.id} style={{ boxShadow: i ? 'inset 0 1px 0 #F4F4F6' : 'none' }}>
                  <div onClick={() => nf.alternar(r.id)} style={css(`display:grid;${grid};gap:12px;align-items:center;padding:12px 18px;cursor:pointer;opacity:0;animation:rowIn .3s ease-out both;animation-delay:${Math.min(i * 25, 300)}ms`)} className={hv('background:#FAFAFB', undefined, undefined)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', color: '#111827', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{r.dia}</div>
                      <div style={{ fontSize: '11.5px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.quem}>{r.hora} · {r.quem}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '32px', height: '32px', flex: 'none', borderRadius: '9px', background: '#E8F8F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DocIcon size={15} color="#14B8A6" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.documento}</div>
                        <div style={{ fontSize: '11.5px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tipo}</div>
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.fornecedor}>{r.fornecedor}</div>
                      <div style={{ fontSize: '11.5px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.empresa}>{r.empresa}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', color: '#111827', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{r.pedido}</div>
                      <div style={{ fontSize: '11.5px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.obra}>{r.obra}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{r.valor}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>Seq. {r.sequencial}</div>
                      <div style={{ fontSize: '11.5px', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>Título {r.titulo}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Chip tom={r.tom}>{r.situacao}</Chip>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', flex: 'none', transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                        <path d="M6 9l6 6 6-6" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                  </div>
                  {aberto ? (
                    <div style={{ padding: '0 18px 14px 146px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'rowIn .2s ease-out both' }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        Vencimento da 1ª parcela {r.vencimento} · {r.anexos} {r.anexos === 1 ? 'anexo' : 'anexos'} no título
                      </div>
                      {r.detalhes.length ? <Alerta tom={r.tom === 'erro' ? 'erro' : 'aviso'} titulo="Pendências para ajuste manual no Sienge" itens={r.detalhes} /> : (
                        <div style={{ fontSize: '12px', color: '#1F7A5C' }}>Sem pendências: nota, vínculo dos insumos, vencimento e anexos gravados.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {/* Outside the horizontal scroll, so the message stays centered on narrow screens. */}
        {!nf.carregando && nf.historico.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '52px 20px', textAlign: 'center' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: '#E8F8F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DocIcon size={22} color="#14B8A6" />
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{nf.filtrado ? 'Nenhuma nota encontrada' : 'Nenhuma nota cadastrada pelo app ainda'}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '420px' }}>
                  {nf.filtrado ? 'Ajuste a busca ou o filtro de situação.' : nf.podeEditar ? 'Clique em "Cadastrar nota" e envie o PDF da NF-e, NFS-e, boleto ou fatura.' : 'As notas cadastradas pela equipe aparecem aqui.'}
                </div>
              </div>
            ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 18px', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          <div style={{ fontSize: '12px', color: '#64748B' }}>{nf.rangeLabel}</div>
          {!nf.podeEditar ? <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#94A3B8' }}>Seu perfil pode consultar, mas não cadastrar notas.</div> : null}
        </div>
      </div>
    </>
  );
}

// ---------- 1. envio ----------

function Envio({ nf }: { nf: any }) {
  const lendo = nf.busy === 'analisar';
  return (
    <>
      <Secao titulo="PDF do documento" sub="NF-e (DANFE), NFS-e, boleto ou fatura de concessionária. O tipo é identificado sozinho." delay={80}>
        <label
          onDragOver={nf.onArrastar}
          onDragLeave={nf.onSair}
          onDrop={nf.onSoltar}
          style={css(`display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:180px;padding:24px;border-radius:12px;border:1.5px dashed ${nf.arrastando ? '#4161FF' : '#D8D8E0'};background:${nf.arrastando ? '#F2F5FF' : '#FAFAFB'};cursor:${lendo ? 'default' : 'pointer'};text-align:center;transition:border-color .15s,background .15s`)}
          className={lendo ? undefined : hv('border-color:#4161FF;background:#F7F9FF', undefined, undefined)}
        >
          <input type="file" accept="application/pdf" hidden disabled={lendo} onChange={nf.onArquivo} />
          <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: nf.arquivo ? '#E8F8F6' : '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 6px ${nf.arquivo ? 'rgba(20,184,166,.07)' : 'rgba(65,97,255,.06)'}` }}>
            {nf.arquivo ? <DocIcon size={22} color="#14B8A6" /> : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="#4161FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            )}
          </div>
          {nf.arquivo ? (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', wordBreak: 'break-all' }}>{nf.arquivo.nome}</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{nf.arquivo.tamanho} · clique ou arraste outro PDF para trocar</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Arraste o PDF aqui ou clique para escolher</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>Um arquivo PDF de até {nf.limiteLabel}</div>
            </div>
          )}
        </label>
        {nf.erro ? <Alerta tom="erro" titulo="Não foi possível analisar o documento">{nf.erro}</Alerta> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
            O documento é lido, o fornecedor e a empresa são localizados pelo CNPJ, e os pedidos de compra em aberto aparecem em seguida.
            Nada é gravado no Sienge nesta etapa.
          </div>
          {nf.arquivo && !lendo ? <button onClick={nf.removerArquivo} style={css(btnSec)} className={hv(btnSecHover, undefined, undefined)}>Remover</button> : null}
          <button onClick={nf.analisar} disabled={!nf.arquivo || lendo} style={css(btnPrim + (!nf.arquivo || lendo ? off : ''))} className={!nf.arquivo || lendo ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
            {lendo ? <><Spinner /> Lendo o documento e buscando os pedidos…</> : 'Analisar documento'}
          </button>
        </div>
      </Secao>
    </>
  );
}

// ---------- 2. pedido ----------

function Pedido({ nf }: { nf: any }) {
  const a = nf.analise;
  const grid = 'grid-template-columns:100px 104px minmax(200px,2fr) 150px 120px 150px';
  const travado = nf.busy.startsWith('pedido:');
  return (
    <>
      <Secao titulo="Documento lido" sub="Confira se a leitura bate com o PDF antes de escolher o pedido." delay={80}>
        <Resumo itens={[
          ['Tipo', a.tipo],
          ['Número', a.numero, `Emissão ${a.emissao}`],
          ['Valor', a.valor],
          ['Fornecedor', a.fornecedor, a.fornecedorCnpj],
          ['Empresa', a.empresa, a.empresaCnpj],
        ]} />
        {a.bloqueios.length ? <Alerta tom="erro" titulo="Não há pedido para vincular" itens={a.bloqueios} /> : null}
      </Secao>

      {a.pedidos.length ? (
        <Secao
          titulo="Escolha o pedido de compra"
          sub={`Pedidos autorizados, não atendidos ou parcialmente atendidos, deste fornecedor para esta empresa.${a.outraEmpresa ? ` ${a.outraEmpresa} pedido(s) em aberto de outras empresas foram omitidos.` : ''}`}
          delay={130}
        >
          <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '820px' }}>
                <div style={css(`display:grid;${grid};gap:12px;align-items:center;padding:10px 16px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
                  <div style={colHead}>Pedido</div>
                  <div style={colHead}>Data</div>
                  <div style={colHead}>Obra</div>
                  <div style={colHead}>Situação</div>
                  <div style={{ ...colHead, textAlign: 'right' }}>Valor total</div>
                  <div></div>
                </div>
                {a.pedidos.map((p: any, i: number) => (
                  <div key={p.id} style={css(`display:grid;${grid};gap:12px;align-items:center;padding:11px 16px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}opacity:0;animation:rowIn .3s ease-out both;animation-delay:${Math.min(i * 30, 300)}ms`)} className={hv('background:#FAFAFB', undefined, undefined)}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{p.numero}</div>
                    <div style={{ fontSize: '12.5px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{p.data}</div>
                    <div style={{ fontSize: '12.5px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.obra}>{p.obra}</div>
                    <div><Chip tom={p.parcial ? 'aviso' : 'info'}>{p.status}</Chip></div>
                    <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{p.valor}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={p.escolher} disabled={travado} style={css(btnPrim + ';height:32px;padding:0 12px;font-size:12px;box-shadow:none' + (travado && !p.carregando ? off : ''))} className={travado ? undefined : hv('background:#3153F4', 'transform:scale(.97)', undefined)}>
                        {p.carregando ? <><Spinner /> Carregando…</> : 'Usar este pedido'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Secao>
      ) : null}

      {nf.erro ? <Alerta tom="erro" titulo="Não foi possível carregar o pedido">{nf.erro}</Alerta> : null}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={nf.voltarEnvio} disabled={travado} style={css(btnSec + ';height:38px' + (travado ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          Enviar outro documento
        </button>
      </div>
    </>
  );
}

// ---------- 3. conferência ----------

function Conferencia({ nf, c }: { nf: any; c: any }) {
  const bloqueado = c.pendencias.length > 0 || c.cadastrando;
  const gridIt = c.comItens
    ? 'grid-template-columns:minmax(220px,1.5fr) 96px 78px 28px minmax(220px,1.6fr) 96px 108px 104px'
    : 'grid-template-columns:28px minmax(260px,1fr) 110px 120px 120px';
  return (
    <>
      {c.bloqueios.length ? <Alerta tom="erro" titulo="Esta nota não pode ser cadastrada" itens={c.bloqueios} /> : null}
      {c.avisos.length ? <Alerta tom="aviso" titulo="Confira antes de salvar" itens={c.avisos} /> : null}

      <Secao titulo="Dados do documento" sub="Os campos vêm do PDF e podem ser corrigidos. Fornecedor e empresa vêm do Sienge, pelo CNPJ." delay={80}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '14px 16px' }}>
          <Campo rotulo="Tipo de documento" dica={c.tipoDetalhe}>
            <select value={c.tipo} onChange={c.onTipo} style={css(input + ';cursor:pointer')}>
              {c.tipos.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Número *"><input value={c.numero} onChange={c.onNumero} maxLength={20} style={css(input)} /></Campo>
          <Campo rotulo="Série"><input value={c.serie} onChange={c.onSerie} style={css(input)} /></Campo>
          <Campo rotulo="Valor do documento"><Leitura valor={c.valor} /></Campo>
          <Campo rotulo={c.fornecedorRotulo} largura={2}><Leitura valor={c.fornecedor} detalhe={c.fornecedorCnpj} /></Campo>
          <Campo rotulo={c.empresaRotulo} largura={2}><Leitura valor={c.empresa} detalhe={c.empresaCnpj} /></Campo>
          <Campo rotulo="Data de emissão *"><input type="date" value={c.dataEmissao} onChange={c.onDataEmissao} style={css(input)} /></Campo>
          <Campo rotulo="Data de movimento *"><input type="date" value={c.dataMovimento} onChange={c.onDataMovimento} style={css(input)} /></Campo>
          <Vencimento c={c} />
          <Campo rotulo="Pedido de compra"><Leitura valor={c.pedido} detalhe={c.pedidoObra} /></Campo>
          <Campo rotulo="Centro de custo *" dica={c.centroNome ? <span style={{ color: '#1F7A5C' }}>{c.centroNome}</span> : 'Precisa ser o mesmo centro de custo do pedido de compra'}>
            <input value={c.centro} onChange={c.onCentro} inputMode="numeric" placeholder="Código do centro de custo" style={css(input)} />
          </Campo>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={colHead}>Observação interna</span>
            <div style={{ padding: '9px 12px', borderRadius: '8px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1', fontSize: '12.5px', color: '#374151' }}>{c.observacaoAutomatica}</div>
            <textarea value={c.obs} onChange={c.onObs} rows={2} placeholder="Complemento opcional" style={css(input + ';height:auto;padding:9px 12px;resize:vertical;line-height:1.45')} />
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>Observações, observações dos insumos e anexos do pedido também são copiados para a nota.</span>
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Insumos do pedido"
        sub={c.criterio || c.semItensDica || 'Marque os insumos que o documento atende e ajuste as quantidades.'}
        acoes={<>
          <button onClick={c.marcarTodos} style={css(btnSec)} className={hv(btnSecHover, undefined, undefined)}>Marcar todos</button>
          <button onClick={c.desmarcarTodos} style={css(btnSec)} className={hv(btnSecHover, undefined, undefined)}>Desmarcar todos</button>
        </>}
        delay={130}
      >
        <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: c.comItens ? '1080px' : '700px' }}>
              {c.comItens ? (
                <div style={css(`display:grid;${gridIt};gap:10px;padding:8px 14px 0;background:#FAFAFB`)}>
                  <div style={{ ...colHead, gridColumn: 'span 2', color: '#14B8A6' }}>Item da nota fiscal</div>
                  <div style={{ ...colHead, textAlign: 'center' }}>Similar.</div>
                  <div style={{ ...colHead, gridColumn: 'span 5', color: '#4161FF' }}>Insumo do pedido de compra</div>
                </div>
              ) : null}
              <div style={css(`display:grid;${gridIt};gap:10px;align-items:center;padding:9px 14px 10px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
                {c.comItens ? <><div style={colHead}>Produto</div><div style={{ ...colHead, textAlign: 'right' }}>Qtd · valor</div><div></div></> : null}
                <div></div>
                <div style={colHead}>Insumo</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Pendente</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Qtd a vincular</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Subtotal</div>
              </div>
              {c.linhas.map((l: any, i: number) => {
                const sim = SIM[l.nivel as keyof typeof SIM];
                return (
                  <div key={l.itemNumber} style={css(`display:grid;${gridIt};gap:10px;align-items:center;padding:10px 14px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}background:${l.selecionado ? '#FBFCFF' : '#FFFFFF'};opacity:${l.semSaldo ? 0.55 : 1};transition:background .15s`)}>
                    {c.comItens ? (
                      <>
                        <div style={{ minWidth: 0 }}>
                          <select value={l.indiceNota} onChange={l.onNota} style={css(input + ';height:34px;font-size:12.5px;cursor:pointer')}>
                            <option value="">— nenhum item da nota —</option>
                            {c.itensNota.map((n: any) => <option key={n.value} value={n.value}>{n.label}</option>)}
                          </select>
                          {l.notaDetalhe ? <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.notaDetalhe}</div> : null}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12.5px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                          {l.notaQtd}
                          {l.notaValor ? <div style={{ fontSize: '11px', color: '#94A3B8' }}>{l.notaValor}</div> : null}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', height: '22px', padding: '0 7px', borderRadius: '20px', background: sim.bg, color: sim.fg, fontSize: '11px', fontWeight: 700 }}>{l.similaridade}</span>
                        </div>
                      </>
                    ) : null}
                    <input type="checkbox" checked={l.selecionado} disabled={l.semSaldo} onChange={l.onSelecionar} aria-label={`Vincular insumo ${l.itemNumber}`} style={{ width: '16px', height: '16px', accentColor: '#4161FF', cursor: l.semSaldo ? 'default' : 'pointer' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', lineHeight: 1.35 }}>{l.insumo}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{l.insumoDetalhe}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12.5px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{l.pendente}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                      <input
                        type="number" step="any" min={0} max={l.max} value={l.quantidade} disabled={!l.selecionado} onChange={l.onQuantidade}
                        aria-invalid={l.problema ? true : undefined}
                        style={css(input + `;height:32px;width:100px;text-align:right;font-variant-numeric:tabular-nums;border-color:${l.problema ? '#FCA5A5' : '#E7E7EA'};background:${l.selecionado ? '#FFFFFF' : '#F4F4F6'}`)}
                      />
                      {l.problema ? <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>{l.problema}</span> : null}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: l.selecionado ? '#111827' : '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>{l.subtotal}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {c.semVinculo.length ? (
          <div style={{ padding: '10px 12px', borderRadius: '9px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Itens da nota sem insumo associado</div>
            <ul style={{ margin: '5px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#64748B', lineHeight: 1.55 }}>
              {c.semVinculo.map((i: any) => <li key={i.indice}>{i.texto}</li>)}
            </ul>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px' }}>
          {[['Valor do documento', c.totalDocumento, '#111827'], ['Insumos selecionados (preço do pedido)', c.totalSelecionado, '#4161FF'], ['Diferença', c.diferenca, c.diferente ? '#D97706' : '#35AD88']].map(([r, val, cor]) => (
            <div key={r} style={{ padding: '10px 12px', borderRadius: '9px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1' }}>
              <div style={colHead}>{r}</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: cor, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
            </div>
          ))}
        </div>
      </Secao>

      <Anexos c={c} />

      <section style={css(`${card};padding:16px 20px;display:flex;flex-direction:column;gap:12px;${anim(200)}`)}>
        {nf.erro ? <Alerta tom="erro" titulo="A nota não foi cadastrada">{nf.erro}</Alerta> : null}
        {c.pendencias.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {c.pendencias.map((p: string) => <Chip key={p} tom="aviso">{p}</Chip>)}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', fontSize: '12px', color: '#64748B' }}>{c.resumo}</div>
          <button onClick={c.voltar} disabled={c.cadastrando} style={css(btnSec + ';height:38px' + (c.cadastrando ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>Voltar aos pedidos</button>
          <button onClick={c.cadastrar} disabled={bloqueado} style={css(btnPrim + (bloqueado && !c.cadastrando ? off : ''))} className={bloqueado ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
            {c.cadastrando ? <><Spinner /> Cadastrando no Sienge…</> : 'Cadastrar no Sienge'}
          </button>
        </div>
      </section>
    </>
  );
}

function Vencimento({ c }: { c: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <span style={colHead}>Vencimento da 1ª parcela *</span>
      {c.vencimentoLiberado ? (
        <input type="date" value={c.vencimento} min={c.vencimentoMin} onChange={c.onVencimento} style={css(input)} />
      ) : (
        <button
          onClick={c.pedirSenha}
          title={c.vencimentoEditavel ? 'Clique para alterar (requer senha)' : 'Alteração manual desligada'}
          style={css(input + `;display:flex;align-items:center;justify-content:space-between;background:#FAFAFB;cursor:${c.vencimentoEditavel ? 'pointer' : 'default'};text-align:left`)}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{c.vencimento.split('-').reverse().join('/')}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="10.5" width="14" height="10" rx="2" stroke="#94A3B8" strokeWidth="1.6"></rect>
            <path d="M8.5 10.5V7.5a3.5 3.5 0 017 0v3" stroke="#94A3B8" strokeWidth="1.6"></path>
          </svg>
        </button>
      )}
      {c.pedindoSenha ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <input type="password" autoFocus autoComplete="off" placeholder="Senha para alterar" aria-label="Senha para alterar o vencimento" value={c.senhaDigitada} onChange={c.onSenha} onKeyDown={c.onSenhaKey} style={css(input + ';height:32px;flex:1 1 120px;width:auto')} />
          <button onClick={c.liberar} disabled={!c.senhaDigitada || c.verificandoSenha} style={css(btnSec + ';height:32px' + (!c.senhaDigitada || c.verificandoSenha ? off : ''))}>{c.verificandoSenha ? '…' : 'Liberar'}</button>
          <button onClick={c.cancelarSenha} style={css(link + ';color:#64748B')}>cancelar</button>
          {c.senhaErro ? <span style={{ width: '100%', fontSize: '11.5px', color: '#DC2626', fontWeight: 600 }}>{c.senhaErro}</span> : null}
        </div>
      ) : c.vencimentoLiberado ? (
        <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>Alterado manualmente · <button onClick={c.restaurarVencimento} style={css(link + ';font-size:11.5px')}>voltar ao padrão</button></span>
      ) : (
        <span style={{ fontSize: '11.5px', color: '#94A3B8', lineHeight: 1.4 }}>
          Padrão: 17 dias corridos após o cadastro{c.vencimentoEditavel ? ' · clique para alterar' : ''}
          {c.vencimentoDocumento ? ` · no documento: ${c.vencimentoDocumento}` : ''}
        </span>
      )}
    </div>
  );
}

function Anexos({ c }: { c: any }) {
  return (
    <Secao
      titulo="Anexos do título a pagar"
      sub="O PDF do cadastro já vai anexado. Adicione os outros documentos da mesma compra (boleto, fatura, NFS-e)."
      acoes={
        <label style={css(btnSec + (c.lendoAnexos ? off : ''))} className={c.lendoAnexos ? undefined : hv(btnSecHover, undefined, undefined)}>
          <input type="file" accept="application/pdf" multiple hidden disabled={c.lendoAnexos} onChange={c.onAnexos} />
          {c.lendoAnexos ? <><Spinner color="#4161FF" /> Lendo arquivos…</> : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
              Adicionar arquivos
            </>
          )}
        </label>
      }
      delay={170}
    >
      <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.55 }}>
        Só PDF, até 3 MB cada; pode selecionar vários de uma vez. Eles vão para a aba Anexos do título no Sienge logo depois do cadastro.
        Use a sigla na descrição: <b>NF</b> (nota fiscal), <b>NFS</b> (nota de serviço), <b>BLT</b> (boleto), <b>FAT</b> (fatura).
      </div>
      {c.recusados.length ? <Alerta tom="aviso" titulo="Arquivos não adicionados" itens={c.recusados} /> : null}
      <datalist id="nf-siglas-anexo">
        {c.sugestoesAnexo.map((s: string) => <option key={s} value={s} />)}
      </datalist>
      <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
        <LinhaAnexo
          descricao={c.descricaoPrincipal} onDescricao={c.onDescricaoPrincipal} max={c.maxDescricao}
          nome={c.nomePrincipal} detalhe="PDF do cadastro · anexado automaticamente" principal
        />
        {c.anexos.map((a: any) => (
          <LinhaAnexo key={a.id} descricao={a.descricao} onDescricao={a.onDescricao} max={c.maxDescricao} nome={a.nome} detalhe={a.tamanho} remover={a.remover} />
        ))}
      </div>
    </Secao>
  );
}

function LinhaAnexo({ descricao, onDescricao, max, nome, detalhe, principal, remover }: { descricao: string; onDescricao: any; max: number; nome: string; detalhe: string; principal?: boolean; remover?: () => void }) {
  const vazio = !descricao.trim();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 80px', gap: '12px', alignItems: 'center', padding: '10px 14px', boxShadow: principal ? 'none' : 'inset 0 1px 0 #F4F4F6' }}>
      <input value={descricao} onChange={onDescricao} list="nf-siglas-anexo" maxLength={max} placeholder="Descrição *" aria-invalid={vazio || undefined} style={css(input + `;height:32px;font-weight:600;border-color:${vazio ? '#FCA5A5' : '#E7E7EA'}`)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <DocIcon size={16} color={principal ? '#14B8A6' : '#94A3B8'} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nome}>{nome}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{detalhe}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {remover ? <button onClick={remover} style={css(link + ';color:#EF4444')}>remover</button> : null}
      </div>
    </div>
  );
}

// ---------- 4. concluído ----------

function Concluido({ nf, r }: { nf: any; r: any }) {
  const corStatus: Record<string, keyof typeof TONS> = { pendente: 'info', enviando: 'info', anexado: 'ok', falhou: 'erro', sem_titulo: 'aviso' };
  return (
    <section style={css(`${card};padding:24px;display:flex;flex-direction:column;gap:16px;${anim(80)}`)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '46px', height: '46px', flex: 'none', borderRadius: '13px', background: '#E9F8F2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 6px rgba(67,185,151,.08)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#35AD88" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#111827' }}>{r.mensagem}</div>
          <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>A nota já está no Sienge e ficou registrada no histórico.</div>
        </div>
      </div>
      <Resumo itens={[['Sequencial da nota', r.sequencial], ['Título (contas a pagar)', r.titulo]]} />
      {r.avisos.length ? <Alerta tom="aviso" titulo="Pendências para ajuste manual" itens={r.avisos} /> : null}
      {r.semTitulo ? <Alerta tom="aviso" titulo="Anexos adicionais não enviados">O Sienge ainda não gerou o título desta nota. Anexe os arquivos abaixo manualmente no título.</Alerta> : null}
      {r.envios.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={colHead}>Anexos adicionais do título</div>
          <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
            {r.envios.map((e: any, i: number) => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) auto', gap: '12px', alignItems: 'center', padding: '10px 14px', boxShadow: i ? 'inset 0 1px 0 #F4F4F6' : 'none' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827' }}>{e.descricao}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nome}</div>
                  {e.erro ? <div style={{ fontSize: '11px', color: '#DC2626' }}>{e.erro}</div> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Chip tom={corStatus[e.status]}>{e.rotulo}</Chip>
                  {e.status === 'falhou' ? <button onClick={e.reenviar} style={css(link)}>tentar de novo</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={nf.outra} disabled={r.enviando} style={css(btnPrim + (r.enviando ? off : ''))} className={r.enviando ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
          {r.enviando ? <><Spinner /> Enviando anexos…</> : 'Cadastrar outra nota'}
        </button>
        <button onClick={nf.verHistorico} disabled={r.enviando} style={css(btnSec + ';height:38px' + (r.enviando ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>Ver notas cadastradas</button>
      </div>
    </section>
  );
}
