// BI › Gerenciar painéis: nome, link público do Power BI, ordem no menu, ativo e rodapé.
// Not generated from the prototype; follows the look of FluxoCfgModal. Logic: logic/vals/bi.ts.
import { css, hv } from '../dc/runtime';

const label = { fontSize: '11px', fontWeight: 600, color: '#374151' } as const;
const iconBtn = 'width:28px;height:28px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,color .15s';

function Switch({ on, track, knob, onClick, text }: { on: boolean; track: string; knob: string; onClick: () => void; text: string }) {
  return (
    <span onClick={onClick} role="switch" aria-checked={on} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'pointer', userSelect: 'none' }}>
      <span style={css(track)}><span style={css(knob)}></span></span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: on ? '#258B6C' : '#64748B' }}>{text}</span>
    </span>
  );
}

export default function BiCfgModal({ v }: { v: any }) {
  if (!v.biCfgOpen) return null;
  return (
    <div style={css('display:flex;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both')} onClick={v.closeBiCfg}>
      <div onClick={e => e.stopPropagation()} style={css('width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both')}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px 24px 16px', boxShadow: 'inset 0 -1px 0 #EEEEF1' }}>
          <div style={{ width: '38px', height: '38px', flex: 'none', borderRadius: '11px', background: '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M5 20v-7M10 20V8M15 20v-5M20 20V4" stroke="#4161FF" strokeWidth="1.9" strokeLinecap="round"></path>
            </svg>
          </div>
          <div style={{ flex: '1', minWidth: '0' }}>
            <div style={{ fontWeight: 700, fontSize: '16.5px', color: '#111827' }}>Painéis de BI</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', lineHeight: 1.5 }}>
              Cada painel vira um item do menu BI e abre o relatório do Power BI publicado na web.
            </div>
          </div>
          <button onClick={v.closeBiCfg} title="Fechar" style={{ width: '30px', height: '30px', flex: 'none', borderRadius: '8px', border: '1px solid #EEEEF1', background: '#FFFFFF', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F7F7F9;border-color:#D8D8E0', undefined, undefined)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"></path>
            </svg>
          </button>
        </div>

        <div style={{ flex: '1', overflowY: 'auto', padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '10px', background: '#FAFAFB', boxShadow: '0 0 0 1px #EEEEF1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                <span style={label}>Nome no menu <span style={{ color: '#EF4444' }}>*</span></span>
                <input value={v.biCfgNome} onChange={v.onBiCfgNome} onKeyDown={v.onBiCfgKey} placeholder="Ex.: Vendas por empreendimento" autoFocus style={css(v.biCfgNomeStyle)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                <span style={label}>Link público do Power BI <span style={{ color: '#EF4444' }}>*</span></span>
                <input value={v.biCfgUrl} onChange={v.onBiCfgUrl} onKeyDown={v.onBiCfgKey} placeholder="https://app.powerbi.com/view?r=…" style={css(v.biCfgUrlStyle)} />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 300px', fontSize: '11.5px', color: '#64748B', lineHeight: 1.5 }}>
                No Power BI: <strong style={{ color: '#374151' }}>Arquivo › Inserir relatório › Publicar na Web</strong>. Cole o link ou o código &lt;iframe&gt; inteiro.
              </span>
              <button onClick={v.addBiCfg} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 14px', borderRadius: '8px', border: '1px solid #C9D5FF', background: '#FFFFFF', color: '#4161FF', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,transform .15s' }} className={hv('background:#EEF2FF', 'transform:scale(.97)', undefined)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                </svg>
                Adicionar painel
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 }}>{v.biCfgCountLabel}</span>
            {v.biCfgRows.length ? (
              <div style={{ borderRadius: '10px', boxShadow: '0 0 0 1px #EEEEF1', overflow: 'hidden' }}>
                {v.biCfgRows.map((r: any) => (
                  <div key={r.key} style={css(r.rowStyle)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 'none' }}>
                        <button onClick={r.up} disabled={!r.canUp} title="Subir no menu" aria-label={`Subir ${r.nome}`} style={css(iconBtn + ';width:22px;height:16px;border-radius:5px' + (r.canUp ? '' : ';opacity:.35;cursor:default'))} className={r.canUp ? hv('border-color:#C9D5FF;color:#4161FF', undefined, undefined) : undefined}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                        <button onClick={r.down} disabled={!r.canDown} title="Descer no menu" aria-label={`Descer ${r.nome}`} style={css(iconBtn + ';width:22px;height:16px;border-radius:5px' + (r.canDown ? '' : ';opacity:.35;cursor:default'))} className={r.canDown ? hv('border-color:#C9D5FF;color:#4161FF', undefined, undefined) : undefined}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                      </div>
                      <input value={r.nome} onChange={r.onNome} placeholder="Nome do painel" aria-label="Nome do painel" style={css(r.nomeStyle)} />
                      {r.isNew ? (
                        <span style={{ flex: 'none', fontSize: '10.5px', fontWeight: 600, color: '#4161FF', background: '#EAF1FF', borderRadius: '20px', padding: '2px 8px' }}>Novo</span>
                      ) : null}
                      <button onClick={r.remove} title="Remover painel" style={css(iconBtn)} className={hv('background:#FEE9E9;border-color:#FCA5A5;color:#DC2626', undefined, undefined)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M5 7h14M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingLeft: '30px' }}>
                      <input value={r.url} onChange={r.onUrl} placeholder="https://app.powerbi.com/view?r=…" aria-label={`Link do painel ${r.nome}`} style={css(r.urlStyle + ';flex:1 1 280px;width:auto')} />
                      <Switch on={r.ativo} track={r.ativoTrackStyle} knob={r.ativoKnobStyle} onClick={r.toggleAtivo} text={r.ativoLabel} />
                      <span title="Recorta a barra inferior do Power BI (compartilhar, zoom e marca). Desligue se o relatório usa a navegação de páginas dessa barra.">
                        <Switch on={r.ocultarRodape} track={r.rodapeTrackStyle} knob={r.rodapeKnobStyle} onClick={r.toggleRodape} text="Ocultar rodapé" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '22px', borderRadius: '10px', boxShadow: '0 0 0 1px #EEEEF1', textAlign: 'center', fontSize: '12.5px', color: '#64748B' }}>
                Nenhum painel cadastrado. Informe o nome e o link acima para adicionar.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: '#64748B', lineHeight: 1.5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', marginTop: '1px' }}>
                <circle cx="12" cy="12" r="8.6" stroke="#94A3B8" strokeWidth="1.7"></circle>
                <path d="M12 11v5M12 8h.01" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"></path>
              </svg>
              <span>
                O Administrador vê todos os painéis. Para liberar um painel a outro perfil, marque-o em <strong style={{ color: '#374151' }}>Configurações › Perfis</strong>, seção BI. Links do "Publicar na Web" são públicos: qualquer pessoa com o link vê o relatório.
              </span>
            </div>
          </div>

          {v.biCfgErr ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#FEE9E9', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: '12.5px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
                <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7"></circle>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
              </svg>
              {v.biCfgErr}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 24px', background: '#FAFAFB', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={v.closeBiCfg} style={{ height: '38px', padding: '0 16px', borderRadius: '9px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F4F4F6;border-color:#D8D8E0', undefined, undefined)}>
              Cancelar
            </button>
            <button onClick={v.saveBiCfg} disabled={v.biCfgSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 18px', border: 'none', borderRadius: '9px', background: '#4161FF', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: v.biCfgSaving ? 'wait' : 'pointer', opacity: v.biCfgSaving ? 0.75 : 1, boxShadow: '0 4px 14px rgba(65,97,255,.26)', transition: 'background .15s,transform .15s' }} className={hv('background:#3153F4', 'transform:scale(.97)', undefined)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              {v.biCfgSaveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
