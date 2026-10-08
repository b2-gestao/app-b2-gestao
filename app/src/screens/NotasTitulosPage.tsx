// Notas Fiscais › Título a Pagar: histórico dos títulos cadastrados e o assistente de cadastro do
// título do contas a pagar no Sienge, sem pedido de compra (envio do PDF → conferência → cadastrado).
// Mesmo visual de NotasCadastrosPage (componentes em ./nf/ui). Logic: logic/vals/notasTitulos.ts.
import { useEffect, useRef } from 'react';
import { css, hv } from '../dc/runtime';
import {
  DocIcon, Spinner, Alerta, Secao, Campo, Leitura, Chip, Resumo, LinhaAnexo, EmpresaModal, Sugestoes, ChamadoConferencia,
} from './nf/ui';
import { colHead, card, anim, input, btnPrim, btnPrimHover, btnSec, btnSecHover, off, link, TONS } from './nf/estilo';

export default function NotasTitulosPage({ v }: { v: any }) {
  const mainRef = useRef<HTMLElement>(null);
  const etapa = v.isNfTitulos ? v.nt.etapa : null;
  // Each step opens at the top (the previous one may have been scrolled down).
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [etapa]);

  if (!v.isNfTitulos) return null;
  const nt = v.nt;
  const lista = nt.etapa === 'lista';

  return (
    <main ref={mainRef} style={css('flex:1;min-height:0;overflow-y:auto;padding:24px 32px 32px;display:flex;flex-direction:column;gap:16px')}>
      <div style={css(`display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;${anim(0)}`)}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '20px', color: '#111827', letterSpacing: '-.01em' }}>
            {lista ? 'Títulos a pagar cadastrados' : 'Cadastrar título a pagar'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
            {lista ? `${nt.totalLabel} · gravados direto no contas a pagar do Sienge` : 'Lê o PDF, localiza credor e empresa no Sienge e grava o título só depois da sua confirmação. Sem pedido de compra.'}
          </div>
        </div>
        {lista ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={nt.recarregar} title="Recarregar o histórico" style={css(btnSec + ';height:38px')} className={hv(btnSecHover, 'transform:scale(.97)', undefined)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              Recarregar
            </button>
            {nt.podeEditar ? (
              <button onClick={nt.novo} style={css(btnPrim)} className={hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"></path>
                </svg>
                Cadastrar título
              </button>
            ) : null}
          </div>
        ) : nt.etapa !== 'concluido' ? (
          <button onClick={nt.cancelar} disabled={nt.busy === 'cadastrar'} style={css(btnSec + ';height:38px' + (nt.busy === 'cadastrar' ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
            Cancelar
          </button>
        ) : null}
      </div>

      {!lista ? <Passos passos={nt.passos} /> : null}
      {lista ? <Historico nt={nt} /> : null}
      {nt.etapa === 'envio' ? <Envio nt={nt} /> : null}
      {nt.etapa === 'conferencia' && nt.conf ? <Conferencia nt={nt} c={nt.conf} /> : null}
      {nt.etapa === 'concluido' && nt.resultado ? <Concluido nt={nt} r={nt.resultado} /> : null}
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

function Historico({ nt }: { nt: any }) {
  const grid = 'grid-template-columns:118px minmax(150px,1.1fr) minmax(170px,1.6fr) 112px 96px 104px 152px';
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
            <input value={nt.busca} onChange={nt.onBusca} placeholder="Número, credor, empresa ou nº do título" style={css(input + ';height:36px;padding-left:33px')} />
          </span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={colHead}>Situação</span>
          <div style={{ display: 'flex', gap: '2px', background: '#F4F4F6', borderRadius: '8px', padding: '3px' }}>
            {nt.situacaoTabs.map((t: any) => (
              <button key={t.label} onClick={t.onClick} style={css(`border:none;border-radius:6px;padding:0 11px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${t.ativo ? '#111827' : 'transparent'};color:${t.ativo ? '#FFFFFF' : '#64748B'}`)}>{t.label}</button>
            ))}
          </div>
        </div>
        {nt.filtrado ? <button onClick={nt.limparFiltros} style={css(btnSec + ';color:#4161FF')}>Limpar filtros</button> : null}
      </div>

      <div style={css(`${card};overflow:hidden;${anim(110)}`)}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '960px' }}>
            <div style={css(`display:grid;${grid};gap:12px;align-items:center;padding:11px 18px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
              <div style={colHead}>Cadastro</div>
              <div style={colHead}>Documento</div>
              <div style={colHead}>Credor · empresa</div>
              <div style={{ ...colHead, textAlign: 'right' }}>Valor</div>
              <div style={colHead}>Vencimento</div>
              <div style={colHead}>Sienge</div>
              <div style={colHead}>Situação</div>
            </div>
            {nt.carregando ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '44px', fontSize: '12.5px', color: '#64748B' }}>
                <Spinner color="#4161FF" /> Carregando os títulos cadastrados…
              </div>
            ) : null}
            {nt.historico.map((r: any, i: number) => {
              const aberto = nt.aberto === r.id;
              return (
                <div key={r.id} style={{ boxShadow: i ? 'inset 0 1px 0 #F4F4F6' : 'none' }}>
                  <div onClick={() => nt.alternar(r.id)} style={css(`display:grid;${grid};gap:12px;align-items:center;padding:12px 18px;cursor:pointer;opacity:0;animation:rowIn .3s ease-out both;animation-delay:${Math.min(i * 25, 300)}ms`)} className={hv('background:#FAFAFB', undefined, undefined)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', color: '#111827', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{r.dia}</div>
                      <div style={{ fontSize: '11.5px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.quem}>{r.hora} · {r.quem}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '32px', height: '32px', flex: 'none', borderRadius: '9px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DocIcon size={15} color="#4161FF" />
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
                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{r.valor}</div>
                      <div style={{ fontSize: '11.5px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{r.parcelas}</div>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{r.vencimento}</div>
                    <div style={{ fontSize: '12.5px', color: '#111827', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Título {r.titulo}</div>
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
                        Competência {r.competencia} · {r.anexos} {r.anexos === 1 ? 'anexo' : 'anexos'} no título
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {r.apropriacoes.map((a: string) => (
                          <span key={a} style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px', borderRadius: '20px', background: '#F4F4F6', color: '#374151', fontSize: '11.5px', fontWeight: 600 }}>{a}</span>
                        ))}
                        {r.apropriacoesObra.map((a: string) => (
                          <span key={a} style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px', borderRadius: '20px', background: '#EEF2FF', color: '#3148B8', fontSize: '11.5px', fontWeight: 600 }}>{a}</span>
                        ))}
                      </div>
                      {r.detalhes.length ? <Alerta tom="aviso" titulo="Pendências para ajuste manual no Sienge" itens={r.detalhes} /> : (
                        <div style={{ fontSize: '12px', color: '#1F7A5C' }}>Sem pendências: título, apropriações e anexos gravados.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {!nt.carregando && nt.historico.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '52px 20px', textAlign: 'center' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DocIcon size={22} color="#4161FF" />
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{nt.filtrado ? 'Nenhum título encontrado' : 'Nenhum título cadastrado pelo app ainda'}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', maxWidth: '420px' }}>
              {nt.filtrado ? 'Ajuste a busca ou o filtro de situação.' : nt.podeEditar ? 'Clique em "Cadastrar título" e envie o PDF da NF-e, NFS-e, boleto ou fatura.' : 'Os títulos cadastrados pela equipe aparecem aqui.'}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 18px', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          <div style={{ fontSize: '12px', color: '#64748B' }}>{nt.rangeLabel}</div>
          {!nt.podeEditar ? <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#94A3B8' }}>Seu perfil pode consultar, mas não cadastrar títulos.</div> : null}
        </div>
      </div>
    </>
  );
}

// ---------- 1. envio ----------

function Envio({ nt }: { nt: any }) {
  const lendo = nt.busy === 'analisar';
  return (
    <Secao titulo="PDF do documento" sub="NF-e (DANFE), NFS-e, boleto ou fatura de concessionária. O tipo é identificado sozinho." delay={80}>
      <label
        onDragOver={nt.onArrastar}
        onDragLeave={nt.onSair}
        onDrop={nt.onSoltar}
        style={css(`display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:180px;padding:24px;border-radius:12px;border:1.5px dashed ${nt.arrastando ? '#4161FF' : '#D8D8E0'};background:${nt.arrastando ? '#F2F5FF' : '#FAFAFB'};cursor:${lendo ? 'default' : 'pointer'};text-align:center;transition:border-color .15s,background .15s`)}
        className={lendo ? undefined : hv('border-color:#4161FF;background:#F7F9FF', undefined, undefined)}
      >
        <input type="file" accept="application/pdf" hidden disabled={lendo} onChange={nt.onArquivo} />
        <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: nt.arquivo ? '#E8F8F6' : '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 6px ${nt.arquivo ? 'rgba(20,184,166,.07)' : 'rgba(65,97,255,.06)'}` }}>
          {nt.arquivo ? <DocIcon size={22} color="#14B8A6" /> : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="#4161FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          )}
        </div>
        {nt.arquivo ? (
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', wordBreak: 'break-all' }}>{nt.arquivo.nome}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{nt.arquivo.tamanho} · clique ou arraste outro PDF para trocar</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Arraste o PDF aqui ou clique para escolher</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>Um arquivo PDF de até {nt.limiteLabel}</div>
          </div>
        )}
      </label>
      {nt.erro ? <Alerta tom="erro" titulo="Não foi possível analisar o documento">{nt.erro}</Alerta> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
          O documento é lido, o credor e a empresa são localizados pelo CNPJ e os dados do título aparecem para conferência.
          Nada é gravado no Sienge nesta etapa.
        </div>
        {nt.arquivo && !lendo ? <button onClick={nt.removerArquivo} style={css(btnSec)} className={hv(btnSecHover, undefined, undefined)}>Remover</button> : null}
        <button onClick={nt.analisar} disabled={!nt.arquivo || lendo} style={css(btnPrim + (!nt.arquivo || lendo ? off : ''))} className={!nt.arquivo || lendo ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
          {lendo ? <><Spinner /> Lendo o documento…</> : 'Analisar documento'}
        </button>
      </div>
    </Secao>
  );
}

// ---------- 2. conferência ----------

function Conferencia({ nt, c }: { nt: any; c: any }) {
  const bloqueado = c.pendencias.length > 0 || c.cadastrando;
  const gridAp = 'grid-template-columns:minmax(200px,1.2fr) minmax(220px,1.4fr) 110px 130px 70px';
  return (
    <>
      {c.bloqueios.length ? <Alerta tom="erro" titulo="Este título não pode ser cadastrado" itens={c.bloqueios} /> : null}
      {c.avisos.length ? <Alerta tom="aviso" titulo="Confira antes de salvar" itens={c.avisos} /> : null}
      {c.empresaModal ? <EmpresaModal m={c.empresaModal} sub="Digite o código da empresa no Sienge que vai pagar o título." /> : null}

      <Secao titulo="Dados do título" sub="Os campos vêm do PDF e podem ser corrigidos. Credor e empresa vêm do Sienge, pelo CNPJ." delay={80}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '14px 16px' }}>
          <Campo rotulo="Tipo de documento" dica={c.tipoDetalhe}>
            <select value={c.tipo} onChange={c.onTipo} style={css(input + ';cursor:pointer')}>
              {c.tipos.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Número do documento *"><input value={c.numero} onChange={c.onNumero} maxLength={20} style={css(input)} /></Campo>
          <Campo rotulo="Valor do título *" dica={c.valorAlterado ? <span style={{ color: '#92590A' }}>Alterado · no PDF: {c.valorLido}</span> : 'Valor bruto do documento'}>
            <input value={c.valor} onChange={c.onValor} inputMode="decimal" placeholder="0,00" style={css(input + ';text-align:right;font-variant-numeric:tabular-nums')} />
          </Campo>
          <Campo rotulo="Desconto" dica={`Valor líquido ${c.liquido}`}>
            <input value={c.desconto} onChange={c.onDesconto} inputMode="decimal" placeholder="0,00" style={css(input + ';text-align:right;font-variant-numeric:tabular-nums')} />
          </Campo>
          <Campo rotulo={c.fornecedorRotulo} largura={2}><Leitura valor={c.fornecedor} detalhe={c.fornecedorCnpj} /></Campo>
          <Campo rotulo={c.empresaRotulo} largura={2} dica={<button type="button" onClick={c.trocarEmpresa} style={css(link + ';font-size:11.5px')}>{c.empresaNaoLocalizada ? 'Informar a empresa' : 'Trocar empresa'}</button>}>
            <Leitura valor={c.empresa} detalhe={c.empresaCnpj} />
          </Campo>
          <Campo rotulo="Data de emissão *"><input type="date" value={c.dataEmissao} onChange={c.onDataEmissao} style={css(input)} /></Campo>
          <Campo rotulo="Competência *" dica="Mês de referência da despesa"><input type="date" value={c.dataCompetencia} onChange={c.onDataCompetencia} style={css(input)} /></Campo>
          <Campo rotulo="Data base *" dica="Base de correção do indexador"><input type="date" value={c.dataBase} onChange={c.onDataBase} style={css(input)} /></Campo>
          <Vencimento c={c} />
          <Campo rotulo="Nº de parcelas *" dica={`De 1 a ${c.maxParcelas}; o Sienge gera as demais a partir do vencimento`}>
            <input value={c.parcelas} onChange={c.onParcelas} inputMode="numeric" style={css(input + ';text-align:right;font-variant-numeric:tabular-nums')} />
          </Campo>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={colHead}>Observação do título</span>
            <div style={{ padding: '9px 12px', borderRadius: '8px', background: '#FAFAFB', boxShadow: 'inset 0 0 0 1px #EEEEF1', fontSize: '12.5px', color: '#374151' }}>{c.observacaoAutomatica}</div>
            <textarea value={c.obs} onChange={c.onObs} rows={2} maxLength={c.maxObs} placeholder="Complemento opcional" style={css(input + ';height:auto;padding:9px 12px;resize:vertical;line-height:1.45')} />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Apropriação financeira"
        sub="Centro de custo e plano financeiro do título. Divida em mais de uma linha para ratear; os percentuais devem somar 100%."
        acoes={<>
          <button onClick={c.dividir} style={css(btnSec)} className={hv(btnSecHover, undefined, undefined)}>Dividir igualmente</button>
          <button onClick={c.adicionar} disabled={!c.podeAdicionar} style={css(btnSec + (c.podeAdicionar ? '' : off))} className={c.podeAdicionar ? hv(btnSecHover, undefined, undefined) : undefined}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
            Adicionar linha
          </button>
        </>}
        delay={130}
      >
        <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '760px' }}>
              <div style={css(`display:grid;${gridAp};gap:12px;align-items:center;padding:10px 14px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
                <div style={colHead}>Centro de custo</div>
                <div style={colHead}>Plano financeiro</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Percentual</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Valor</div>
                <div></div>
              </div>
              {c.apropriacoes.map((a: any, i: number) => (
                <div key={a.id} style={css(`display:grid;${gridAp};gap:12px;align-items:start;padding:10px 14px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}animation:rowIn .25s ease-out both`)}>
                  <div style={{ minWidth: 0 }}>
                    <Sugestoes value={a.centro} onChange={a.onCentro} opcoes={c.centrosOpcoes} inputMode="numeric" placeholder="Código" ariaLabel={`Centro de custo da linha ${i + 1}`} />
                    <div style={{ fontSize: '11px', color: a.centroNome ? '#1F7A5C' : '#94A3B8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.centroNome}>{a.centroNome || 'Digite ou escolha o código'}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Sugestoes value={a.plano} onChange={a.onPlano} opcoes={c.planosOpcoes} porNome placeholder="Buscar pelo nome ou digitar o código" ariaLabel={`Plano financeiro da linha ${i + 1}`} />
                    <div style={{ fontSize: '11px', color: a.planoNome ? '#1F7A5C' : '#94A3B8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.planoNome}>{a.planoNome || 'Código sem máscara, ex.: 201030101 · conferido no Sienge ao salvar'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <span style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                      <input value={a.percentual} onChange={a.onPercentual} inputMode="decimal" aria-label={`Percentual da linha ${i + 1}`} aria-invalid={a.problema ? true : undefined}
                        style={css(input + `;height:34px;text-align:right;padding-right:24px;font-variant-numeric:tabular-nums;border-color:${a.problema ? '#FCA5A5' : '#E7E7EA'}`)} />
                      <span style={{ position: 'absolute', right: '10px', fontSize: '12px', color: '#94A3B8', pointerEvents: 'none' }}>%</span>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums', paddingTop: '9px' }}>{a.valor}</div>
                  <div style={{ textAlign: 'right', paddingTop: '9px' }}>
                    {a.remover ? <button onClick={a.remover} style={css(link + ';color:#EF4444')}>remover</button> : null}
                  </div>
                  {a.problema ? <div style={{ gridColumn: '1 / -1', marginTop: '-4px', fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>{a.problema}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <span style={colHead}>Total apropriado</span>
          <Chip tom={c.somaOk ? 'ok' : 'aviso'}>{c.totalPct}</Chip>
        </div>
      </Secao>

      <ApropriacaoObra c={c} />

      <Anexos c={c} />

      <section style={css(`${card};padding:16px 20px;display:flex;flex-direction:column;gap:12px;${anim(200)}`)}>
        {nt.erro ? <Alerta tom="erro" titulo="O título não foi cadastrado">{nt.erro}</Alerta> : null}
        {c.pendencias.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {c.pendencias.map((p: string) => <Chip key={p} tom="aviso">{p}</Chip>)}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', fontSize: '12px', color: '#64748B' }}>{c.resumo}</div>
          <button onClick={c.voltar} disabled={c.cadastrando} style={css(btnSec + ';height:38px' + (c.cadastrando ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>Enviar outro documento</button>
          <button onClick={c.cadastrar} disabled={bloqueado} style={css(btnPrim + (bloqueado && !c.cadastrando ? off : ''))} className={bloqueado ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
            {c.cadastrando ? <><Spinner /> Cadastrando no Sienge…</> : 'Cadastrar título no Sienge'}
          </button>
        </div>
      </section>
    </>
  );
}

function ApropriacaoObra({ c }: { c: any }) {
  const grid = 'grid-template-columns:minmax(170px,1fr) minmax(190px,1.1fr) minmax(240px,1.6fr) 100px 120px 64px';
  const nota = { fontSize: '11px', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
  return (
    <Secao
      titulo="Apropriação de obra"
      sub="Obra, unidade construtiva e item do orçamento do Sienge. Opcional: deixe a linha em branco se o título não é de obra. Os percentuais devem somar 100%."
      acoes={<>
        <button onClick={c.dividirObra} style={css(btnSec)} className={hv(btnSecHover, undefined, undefined)}>Dividir igualmente</button>
        <button onClick={c.adicionarObra} disabled={!c.podeAdicionarObra} style={css(btnSec + (c.podeAdicionarObra ? '' : off))} className={c.podeAdicionarObra ? hv(btnSecHover, undefined, undefined) : undefined}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
          Adicionar linha
        </button>
      </>}
      delay={150}
    >
      {c.apropriacoesObra.length ? (
        <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '900px' }}>
              <div style={css(`display:grid;${grid};gap:12px;align-items:center;padding:10px 14px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
                <div style={colHead}>Obra</div>
                <div style={colHead}>Unidade construtiva</div>
                <div style={colHead}>Item do orçamento</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Percentual</div>
                <div style={{ ...colHead, textAlign: 'right' }}>Valor</div>
                <div></div>
              </div>
              {c.apropriacoesObra.map((a: any, i: number) => (
                <div key={a.id} style={css(`display:grid;${grid};gap:12px;align-items:start;padding:10px 14px;${i ? 'box-shadow:inset 0 1px 0 #F4F4F6;' : ''}animation:rowIn .25s ease-out both`)}>
                  <div style={{ minWidth: 0 }}>
                    <Sugestoes value={a.obra} onChange={a.onObra} opcoes={c.obrasOpcoes} inputMode="numeric" placeholder="Código da obra" ariaLabel={`Obra da linha ${i + 1}`} />
                    {a.obraErro ? (
                      <div style={{ ...nota, color: '#DC2626' }} title={a.obraErro}>
                        {a.recarregarObra ? <button onClick={a.recarregarObra} style={css(link + ';font-size:11px')}>tentar de novo</button> : null}
                      </div>
                    ) : a.usarSugerida ? (
                      <div style={{ ...nota, color: '#94A3B8' }}>
                        <button onClick={a.usarSugerida} style={css(link + ';font-size:11px')}>usar a obra {a.sugerida}</button> (centro de custo)
                      </div>
                    ) : (
                      <div style={{ ...nota, color: a.obraNome ? '#1F7A5C' : '#94A3B8' }} title={a.obraNome}>{a.obraNome || 'Digite ou escolha o código'}</div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <select value={a.unidade} onChange={a.onUnidade} disabled={a.unidadeDesabilitada} aria-label={`Unidade construtiva da linha ${i + 1}`}
                      style={css(input + `;height:34px;cursor:${a.unidadeDesabilitada ? 'not-allowed' : 'pointer'}${a.unidadeDesabilitada ? ';background:#FAFAFB' : ''}`)}>
                      <option value="">{a.unidadeDesabilitada ? '—' : 'Escolha a unidade'}</option>
                      {a.unidadesOpcoes.map((u: any) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                    {a.unidadeDica ? <div style={{ ...nota, color: '#92590A' }}>{a.unidadeDica}</div> : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Sugestoes value={a.item} onChange={a.onItem} opcoes={a.itensOpcoes} porNome padraoCodigo={/^[\d.]*$/} disabled={a.itemDesabilitado}
                      placeholder={a.itemDesabilitado ? 'Escolha a obra e a unidade' : 'Buscar pelo nome ou código'} ariaLabel={`Item do orçamento da linha ${i + 1}`} />
                    <div style={{ ...nota, color: a.item && a.itemNome && !a.problema ? '#1F7A5C' : '#94A3B8' }} title={a.itemNome}>
                      {a.recarregarItens ? <button onClick={a.recarregarItens} style={css(link + ';font-size:11px')}>tentar de novo</button> : a.itemNome}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <span style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                      <input value={a.percentual} onChange={a.onPercentual} inputMode="decimal" aria-label={`Percentual da obra na linha ${i + 1}`} aria-invalid={a.problema ? true : undefined}
                        style={css(input + `;height:34px;text-align:right;padding-right:24px;font-variant-numeric:tabular-nums;border-color:${a.problema ? '#FCA5A5' : '#E7E7EA'}`)} />
                      <span style={{ position: 'absolute', right: '10px', fontSize: '12px', color: '#94A3B8', pointerEvents: 'none' }}>%</span>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums', paddingTop: '9px' }}>{a.valor}</div>
                  <div style={{ textAlign: 'right', paddingTop: '9px' }}>
                    <button onClick={a.remover} style={css(link + ';color:#EF4444')}>remover</button>
                  </div>
                  {a.problema ? <div style={{ gridColumn: '1 / -1', marginTop: '-4px', fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>{a.problema}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {c.semObra ? (
        <div style={{ fontSize: '12px', color: '#92590A', lineHeight: 1.5 }}>
          Sem apropriação de obra: o título vai para o Sienge só com a apropriação financeira. Se o plano financeiro exige obra, o Sienge vai pedir a apropriação no título.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <span style={colHead}>Total apropriado em obra</span>
          <Chip tom={c.somaObraOk ? 'ok' : 'aviso'}>{c.totalPctObra}</Chip>
        </div>
      )}
    </Secao>
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
      sub="O PDF do cadastro já vai anexado. Adicione os outros documentos da mesma despesa (boleto, fatura, NFS-e)."
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
      <div style={{ borderRadius: '9px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
        <LinhaAnexo
          descricao={c.descricaoPrincipal} onDescricao={c.onDescricaoPrincipal} sugestoes={c.sugestoesAnexo.map((s: string) => ({ value: s }))} max={c.maxDescricao}
          nome={c.nomePrincipal} detalhe="PDF do cadastro · anexado automaticamente" principal
        />
        {c.anexos.map((a: any) => (
          <LinhaAnexo key={a.id} descricao={a.descricao} onDescricao={a.onDescricao} sugestoes={c.sugestoesAnexo.map((s: string) => ({ value: s }))} max={c.maxDescricao} nome={a.nome} detalhe={a.tamanho} remover={a.remover} />
        ))}
      </div>
    </Secao>
  );
}

// ---------- 3. concluído ----------

function Concluido({ nt, r }: { nt: any; r: any }) {
  const corStatus: Record<string, keyof typeof TONS> = { pendente: 'info', enviando: 'info', anexado: 'ok', falhou: 'erro', sem_titulo: 'aviso' };
  return (
    <section style={css(`${card};padding:24px;display:flex;flex-direction:column;gap:16px;${anim(80)}`)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '46px', height: '46px', flex: 'none', borderRadius: '13px', background: '#E9F8F2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 6px rgba(67,185,151,.08)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#35AD88" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#111827' }}>{r.mensagem}</div>
          <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>O título já está no contas a pagar do Sienge e ficou registrado no histórico.</div>
        </div>
      </div>
      <Resumo itens={[['Título (contas a pagar)', r.titulo]]} />
      {r.avisos.length ? <Alerta tom="aviso" titulo="Pendências para ajuste manual" itens={r.avisos} /> : null}
      {r.semTitulo ? <Alerta tom="aviso" titulo="Anexos adicionais não enviados">O Sienge não informou o número do título. Anexe os arquivos abaixo manualmente no título.</Alerta> : null}
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
      {r.chamado ? <ChamadoConferencia c={r.chamado} /> : null}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={nt.outra} disabled={r.enviando} style={css(btnPrim + (r.enviando ? off : ''))} className={r.enviando ? undefined : hv(btnPrimHover, 'transform:scale(.97)', undefined)}>
          {r.enviando ? <><Spinner /> Enviando anexos…</> : 'Cadastrar outro título'}
        </button>
        <button onClick={nt.verHistorico} disabled={r.enviando} style={css(btnSec + ';height:38px' + (r.enviando ? off : ''))} className={hv(btnSecHover, undefined, undefined)}>Ver títulos cadastrados</button>
      </div>
    </section>
  );
}
