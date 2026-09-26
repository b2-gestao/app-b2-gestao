// Fluxo de caixa › engrenagem: empresas cujas parcelas a receber não entram no fluxo.
// Not generated from the prototype; follows the look of DeptModal. Logic: logic/vals/fluxoCfg.ts.
import { css, hv } from '../dc/runtime';

const label = { fontSize: '11px', fontWeight: 600, color: '#374151' } as const;

export default function FluxoCfgModal({ v }: { v: any }) {
  if (!v.fxCfgOpen) return null;
  return (
    <div style={css('display:flex;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both')} onClick={v.closeFxCfg}>
      <div onClick={e => e.stopPropagation()} style={css('width:100%;max-width:680px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both')}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px 24px 16px', boxShadow: 'inset 0 -1px 0 #EEEEF1' }}>
          <div style={{ width: '38px', height: '38px', flex: 'none', borderRadius: '11px', background: '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#4161FF" strokeWidth="1.7"></circle>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#4161FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </div>
          <div style={{ flex: '1', minWidth: '0' }}>
            <div style={{ fontWeight: 700, fontSize: '16.5px', color: '#111827' }}>Empresas sem recebíveis no fluxo</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', lineHeight: 1.5 }}>
              As parcelas a receber destas empresas não entram nas receitas do fluxo de caixa (recebíveis já comprometidos).
            </div>
          </div>
          <button onClick={v.closeFxCfg} title="Fechar" style={{ width: '30px', height: '30px', flex: 'none', borderRadius: '8px', border: '1px solid #EEEEF1', background: '#FFFFFF', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F7F7F9;border-color:#D8D8E0', undefined, undefined)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"></path>
            </svg>
          </button>
        </div>

        <div style={{ flex: '1', overflowY: 'auto', padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '10px', background: '#FAFAFB', boxShadow: '0 0 0 1px #EEEEF1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                <span style={label}>Empresa <span style={{ color: '#EF4444' }}>*</span></span>
                <input value={v.fxCfgQuery} onChange={v.onFxCfgQuery} placeholder="Pesquisar por código ou nome" autoFocus style={css(v.fxCfgQueryStyle)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                <span style={label}>Motivo de não considerar <span style={{ color: '#EF4444' }}>*</span></span>
                <input value={v.fxCfgMotivo} onChange={v.onFxCfgMotivo} onKeyDown={v.onFxCfgMotivoKey} placeholder="Ex.: recebíveis 100% comprometidos" style={css(v.fxCfgMotivoStyle)} />
              </label>
            </div>
            {v.fxCfgResults.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '220px', overflowY: 'auto', borderRadius: '8px', background: '#FFFFFF', boxShadow: '0 0 0 1px #E7E7EA', padding: '4px' }}>
                {v.fxCfgResults.map((r: any) => (
                  <div key={r.cd} onClick={r.onClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', color: '#374151', cursor: 'pointer', transition: 'background .12s' }} className={hv('background:#F4F4F6', undefined, undefined)}>
                    <span style={{ flex: 'none', minWidth: '34px', padding: '2px 6px', borderRadius: '5px', background: '#EAF1FF', color: '#2445E8', fontSize: '10.5px', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.cd}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {v.fxCfgNoResults ? (
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma empresa encontrada (ou já está na lista).</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={v.addFxCfg} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 14px', borderRadius: '8px', border: '1px solid #C9D5FF', background: '#FFFFFF', color: '#4161FF', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,transform .15s' }} className={hv('background:#EEF2FF', 'transform:scale(.97)', undefined)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                </svg>
                Adicionar empresa
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 }}>{v.fxCfgCountLabel}</span>
            {v.fxCfgRows.length ? (
              <div style={{ borderRadius: '10px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
                {v.fxCfgRows.map((r: any, i: number) => (
                  <div key={r.cd} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr) 32px', gap: '12px', alignItems: 'center', padding: '10px 12px', boxShadow: i ? 'inset 0 1px 0 #F4F4F6' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <span style={{ flex: 'none', minWidth: '34px', padding: '2px 6px', borderRadius: '5px', background: '#EAF1FF', color: '#2445E8', fontSize: '10.5px', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.cd}</span>
                      <span title={r.name} style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    </div>
                    <input value={r.motivo} onChange={r.onMotivo} placeholder="Motivo" aria-label={`Motivo da empresa ${r.cd}`} style={css(r.motivoStyle + ';height:34px')} />
                    <button onClick={r.remove} title="Remover da lista" style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #EEEEF1', background: '#FFFFFF', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'border-color .15s,background .15s,color .15s' }} className={hv('background:#FEE9E9;border-color:#FCA5A5;color:#DC2626', undefined, undefined)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 7h14M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '22px', borderRadius: '10px', boxShadow: '0 0 0 1px #EEEEF1', textAlign: 'center', fontSize: '12.5px', color: '#64748B' }}>
                Todas as empresas consideram as parcelas a receber. Pesquise uma empresa acima para adicionar.
              </div>
            )}
          </div>

          {v.fxCfgErr ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#FEE9E9', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: '12.5px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
                <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7"></circle>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
              </svg>
              {v.fxCfgErr}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 24px', background: '#FAFAFB', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={v.closeFxCfg} style={{ height: '38px', padding: '0 16px', borderRadius: '9px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F4F4F6;border-color:#D8D8E0', undefined, undefined)}>
              Cancelar
            </button>
            <button onClick={v.saveFxCfg} disabled={v.fxCfgSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 18px', border: 'none', borderRadius: '9px', background: '#4161FF', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: v.fxCfgSaving ? 'wait' : 'pointer', opacity: v.fxCfgSaving ? 0.75 : 1, boxShadow: '0 4px 14px rgba(65,97,255,.26)', transition: 'background .15s,transform .15s' }} className={hv('background:#3153F4', 'transform:scale(.97)', undefined)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              {v.fxCfgSaveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
