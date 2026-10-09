// Configurações › Gerais: empresas desconsideradas em todo o sistema.
// Not generated from the prototype; same visual language as CategoriasPage. Logic: logic/vals/gerais.ts.
import { css, hv } from '../dc/runtime';

const colHead = { fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 } as const;
const card = { borderRadius: '10px', background: '#FFFFFF', boxShadow: '0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03),0 4px 16px rgba(0,0,0,.025)' } as const;
const codeTag = { flex: 'none', minWidth: '34px', padding: '2px 6px', borderRadius: '5px', background: '#F1F1F4', color: '#374151', fontSize: '10.5px', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' } as const;

export default function GeraisPage({ v }: { v: any }) {
  if (!v.isGerais) return null;
  return (
    <main style={{ flex: '1', minHeight: '0', overflowY: 'auto', padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ opacity: 0, animation: 'fadeInUp .45s ease-out both' }}>
        <div style={{ fontWeight: 700, fontSize: '20px', color: '#111827', letterSpacing: '-.01em' }}>Configurações gerais</div>
        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>Regras que valem para todo o sistema</div>
      </div>

      <section style={{ ...card, display: 'flex', flexDirection: 'column', opacity: 0, animation: 'fadeInUp .45s ease-out both', animationDelay: '60ms' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '18px 18px 14px' }}>
          <div style={{ width: '34px', height: '34px', flex: 'none', borderRadius: '9px', background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M4 20V6.5a1 1 0 011-1h7a1 1 0 011 1V20M13 10h6a1 1 0 011 1v9M3 20h18M7.5 9h2M7.5 12.5h2M7.5 16h2" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"></path>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Empresas desconsideradas</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{v.gerCountLabel}</div>
          </div>
        </div>

        <div style={{ margin: '0 18px 14px', display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '10px 12px', borderRadius: '9px', background: '#FAFAFB', boxShadow: '0 0 0 1px #EEEEF1', fontSize: '12px', color: '#4B5563', lineHeight: 1.5 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', marginTop: '1px' }}>
            <circle cx="12" cy="12" r="8.6" stroke="#64748B" strokeWidth="1.6"></circle>
            <path d="M12 11v5M12 8h.01" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"></path>
          </svg>
          <span>
            Empresas baixadas ou fora por regra de negócio. Nenhum dado delas é usado no app: somem dos seletores, saldos,
            programação, fluxo de caixa, painel, lançamentos, notas fiscais e CRC. Remover da lista volta a considerá-las.
          </span>
        </div>

        {v.gerPodeEditar ? (
          <div style={{ margin: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 260px', minWidth: 0 }}>
                <span style={colHead}>Empresa <span style={{ color: '#EF4444' }}>*</span></span>
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: '11px', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="6.5" stroke="#A8B0BD" strokeWidth="1.8"></circle>
                    <path d="M16 16l4.5 4.5" stroke="#A8B0BD" strokeWidth="1.8" strokeLinecap="round"></path>
                  </svg>
                  <input value={v.gerQuery} onChange={v.onGerQuery} placeholder="Pesquisar por código ou nome" style={css(v.gerQueryStyle)} />
                </span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 260px', minWidth: 0 }}>
                <span style={colHead}>Motivo <span style={{ color: '#EF4444' }}>*</span></span>
                <input value={v.gerMotivo} onChange={v.onGerMotivo} onKeyDown={v.onGerMotivoKey} placeholder="Ex.: empresa baixada em 2025" maxLength={300} style={css(v.gerMotivoStyle)} />
              </label>
              <button onClick={v.addGer} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '38px', padding: '0 14px', borderRadius: '8px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#111827', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,border-color .15s,transform .15s' }} className={hv('background:#F4F4F6;border-color:#D8D8E0', 'transform:scale(.97)', undefined)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                </svg>
                Adicionar
              </button>
            </div>
            {v.gerResults.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '240px', overflowY: 'auto', borderRadius: '8px', background: '#FFFFFF', boxShadow: '0 0 0 1px #E7E7EA,0 8px 24px rgba(0,0,0,.06)', padding: '4px', animation: 'fadeInUp .2s ease-out both' }}>
                {v.gerResults.map((r: any) => (
                  <div key={r.cd} onClick={r.onClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', color: '#374151', cursor: 'pointer', transition: 'background .12s' }} className={hv('background:#F4F4F6', undefined, undefined)}>
                    <span style={codeTag}>{r.cd}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {v.gerNoResults ? (
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma empresa encontrada (ou já está na lista).</div>
            ) : null}
          </div>
        ) : null}

        {v.gerErr ? (
          <div style={{ margin: '0 18px 14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#FEE9E9', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: '12.5px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
              <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7"></circle>
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
            {v.gerErr}
          </div>
        ) : null}

        <div style={{ overflowX: 'auto', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          <div style={{ minWidth: '600px' }}>
            <div style={css(`display:grid;${v.gerGridStyle};gap:12px;align-items:center;padding:11px 18px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
              <div style={colHead}>Código</div>
              <div style={colHead}>Empresa</div>
              <div style={colHead}>Motivo</div>
              <div style={{ ...colHead, textAlign: 'right' }}>Ação</div>
            </div>
            {v.gerLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '12.5px', color: '#94A3B8' }}>Carregando…</div>
            ) : v.gerEmpty ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '44px 20px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="#CBD5E1" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Todas as empresas são consideradas</div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>{v.gerPodeEditar ? 'Pesquise uma empresa acima para desconsiderá-la.' : 'Nenhuma empresa desconsiderada.'}</div>
              </div>
            ) : v.gerRows.map((r: any) => (
              <div key={r.cd} style={css(r.rowStyle)} className={hv('background:#FAFAFB', undefined, undefined)}>
                <div><span style={codeTag}>{r.cd}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span title={r.name} style={{ fontSize: '13px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  {r.novo ? <span style={{ flex: 'none', padding: '0 6px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, lineHeight: '17px', color: '#4161FF', background: '#EEF2FF' }}>Novo</span> : null}
                </div>
                {v.gerPodeEditar ? (
                  <input value={r.motivo} onChange={r.onMotivo} placeholder="Motivo" maxLength={300} aria-label={`Motivo da empresa ${r.cd}`} style={css(r.motivoStyle)} />
                ) : (
                  <div title={r.motivo} style={{ fontSize: '12.5px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.motivo}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {v.gerPodeEditar ? (
                    <button onClick={r.remove} title="Voltar a considerar a empresa" style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #EEEEF1', background: '#FFFFFF', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'border-color .15s,background .15s,color .15s' }} className={hv('background:#FEE9E9;border-color:#FCA5A5;color:#DC2626', undefined, undefined)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 7h14M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '12px 18px', boxShadow: 'inset 0 1px 0 #EEEEF1', background: '#FAFAFB', borderRadius: '0 0 10px 10px' }}>
          <div style={{ fontSize: '12px', color: v.gerDirty ? '#B45309' : '#64748B', fontWeight: v.gerDirty ? 600 : 400 }}>{v.gerFooterLabel}</div>
          {v.gerPodeEditar ? (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {v.gerDirty ? (
                <button onClick={v.discardGer} disabled={v.gerSaving} style={{ height: '36px', padding: '0 14px', borderRadius: '9px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F4F4F6;border-color:#D8D8E0', undefined, undefined)}>
                  Descartar
                </button>
              ) : null}
              <button onClick={v.saveGer} disabled={!v.gerDirty || v.gerSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '36px', padding: '0 16px', border: 'none', borderRadius: '9px', background: '#111827', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: v.gerSaving ? 'wait' : (v.gerDirty ? 'pointer' : 'default'), opacity: v.gerDirty ? (v.gerSaving ? 0.75 : 1) : 0.4, transition: 'background .15s,transform .15s,opacity .15s' }} className={hv('background:#1F2937', 'transform:scale(.97)', undefined)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                {v.gerSaveLabel}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
