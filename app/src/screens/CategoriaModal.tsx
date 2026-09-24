// Cadastros › Financeiro › Categorias: modal de nova/editar categoria.
// Not generated from the prototype; same markup as DeptModal. Logic: logic/vals/categorias.ts.
import { css, hv } from '../dc/runtime';
import { TagIcon } from './CategoriasPage';

const label = { fontSize: '11px', fontWeight: 600, color: '#374151' } as const;

export default function CategoriaModal({ v }: { v: any }) {
  if (!v.catModalOpen) return null;
  return (
    <div style={css('display:flex;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both')} onClick={v.closeCatModal}>
      <div onClick={e => e.stopPropagation()} style={css('width:100%;max-width:560px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both')}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px 24px 16px', boxShadow: 'inset 0 -1px 0 #EEEEF1' }}>
          <div style={{ width: '38px', height: '38px', flex: 'none', borderRadius: '11px', background: '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TagIcon size={19} />
          </div>
          <div style={{ flex: '1', minWidth: '0' }}>
            <div style={{ fontWeight: 700, fontSize: '16.5px', color: '#111827' }}>{v.catModalTitle}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{v.catModalSub}</div>
          </div>
          <button onClick={v.closeCatModal} title="Fechar" style={{ width: '30px', height: '30px', flex: 'none', borderRadius: '8px', border: '1px solid #EEEEF1', background: '#FFFFFF', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F7F7F9;border-color:#D8D8E0', undefined, undefined)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"></path>
            </svg>
          </button>
        </div>

        <div style={{ flex: '1', overflowY: 'auto', padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(224px,1fr))', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>Nome da categoria <span style={{ color: '#EF4444' }}>*</span></span>
              <input value={v.cfName} onChange={v.onCfName} onKeyDown={e => { if (e.key === 'Enter') v.saveCat(); }} placeholder="Ex.: Taxa Administração" autoFocus style={css(v.cfNameStyle)} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={label}>Situação</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E7E7EA', background: '#FAFAFB' }}>
                <div onClick={v.toggleCfActive} style={css(v.cfTrackStyle)}>
                  <span style={css(v.cfKnobStyle)}></span>
                </div>
                <span style={css(v.cfActiveLabelStyle)}>{v.cfActiveLabel}</span>
              </div>
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>Descrição</span>
            <textarea value={v.cfDesc} onChange={v.onCfDesc} placeholder="Ex.: Taxa de administração cobrada das SPEs pela holding." style={{ minHeight: '76px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E7E7EA', background: '#FFFFFF', fontSize: '13px', fontFamily: 'inherit', color: '#111827', resize: 'vertical', transition: 'border-color .15s,box-shadow .15s' }}></textarea>
          </label>
          <div style={css(v.catFormErrStyle)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
              <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7"></circle>
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
            {v.catFormErr}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '14px 24px', background: '#FAFAFB', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          {v.catEditing ? (
            <button onClick={v.removeCat} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '38px', padding: '0 14px', borderRadius: '9px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#DC2626', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#FEE9E9;border-color:#FCA5A5', undefined, undefined)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 7h14M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              Excluir
            </button>
          ) : null}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={v.closeCatModal} style={{ height: '38px', padding: '0 16px', borderRadius: '9px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F4F4F6;border-color:#D8D8E0', undefined, undefined)}>
              Cancelar
            </button>
            <button onClick={v.saveCat} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 18px', border: 'none', borderRadius: '9px', background: '#4161FF', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(65,97,255,.26)', transition: 'background .15s,transform .15s' }} className={hv('background:#3153F4', 'transform:scale(.97)', undefined)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              {v.saveCatLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
