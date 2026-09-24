// Cadastros › Financeiro › Categorias: categorias dos lançamentos manuais.
// Not generated from the prototype; same markup as DepartamentosPage. Logic: logic/vals/categorias.ts.
import { css, hv } from '../dc/runtime';

const colHead = { fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 } as const;

function TagIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1 1 0 010 1.4l-7.3 7.3a1 1 0 01-1.4 0z" stroke="#4161FF" strokeWidth="1.6" strokeLinejoin="round"></path>
      <circle cx="8.2" cy="8.2" r="1.6" stroke="#4161FF" strokeWidth="1.5"></circle>
    </svg>
  );
}

export { TagIcon };

export default function CategoriasPage({ v }: { v: any }) {
  if (!v.isCategorias) return null;
  return (
    <main style={{ flex: '1', minHeight: '0', overflowY: 'auto', padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', opacity: 0, animation: 'fadeInUp .45s ease-out both' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '20px', color: '#111827', letterSpacing: '-.01em' }}>Categorias cadastradas</div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{v.cCountLabel} · usadas nos lançamentos manuais</div>
        </div>
        <button onClick={v.openNewCat} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 16px', border: 'none', borderRadius: '9px', background: '#4161FF', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(65,97,255,.26)', transition: 'background .15s,transform .15s,box-shadow .15s' }} className={hv('background:#3153F4;box-shadow:0 8px 20px rgba(65,97,255,.34)', 'transform:scale(.97)', undefined)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"></path>
          </svg>
          Nova categoria
        </button>
      </div>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', padding: '14px 16px', borderRadius: '10px', background: '#FFFFFF', boxShadow: '0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03)', opacity: 0, animation: 'fadeInUp .45s ease-out both', animationDelay: '60ms' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 250px', minWidth: '0' }}>
          <span style={colHead}>Buscar</span>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: '11px', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="6.5" stroke="#A8B0BD" strokeWidth="1.8"></circle>
              <path d="M16 16l4.5 4.5" stroke="#A8B0BD" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
            <input value={v.cSearch} onChange={v.onCSearch} placeholder="Nome ou descrição" style={{ width: '100%', height: '36px', padding: '0 12px 0 33px', borderRadius: '8px', border: '1px solid #E7E7EA', background: '#FFFFFF', fontSize: '13px', fontFamily: 'inherit', color: '#111827', transition: 'border-color .15s,box-shadow .15s' }} />
          </span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={colHead}>Situação</span>
          <div style={{ display: 'flex', gap: '2px', background: '#F4F4F6', borderRadius: '8px', padding: '3px' }}>
            {v.cStatusTabs.map((t: any) => (
              <button key={t.label} onClick={t.onClick} style={css(t.style)}>{t.label}</button>
            ))}
          </div>
        </div>
        <button onClick={v.clearCatFilters} style={css(v.clearCatFiltersStyle)}>Limpar filtros</button>
      </div>

      <div style={{ borderRadius: '10px', background: '#FFFFFF', boxShadow: '0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03),0 4px 16px rgba(0,0,0,.025)', overflow: 'hidden', opacity: 0, animation: 'fadeInUp .45s ease-out both', animationDelay: '110ms' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '560px' }}>
            <div style={css(`display:grid;${v.cGridStyle};gap:12px;align-items:center;padding:11px 18px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`)}>
              <div style={colHead}>Categoria</div>
              <div style={colHead}>Descrição</div>
              <div style={colHead}>Status</div>
              <div style={{ ...colHead, textAlign: 'right' }}>Ação</div>
            </div>
            {v.cRows.map((c: any) => (
              <div key={c.name} style={css(c.rowStyle)} className={hv('background:#FAFAFB', undefined, undefined)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: '0' }}>
                  <div style={{ width: '34px', height: '34px', flex: 'none', borderRadius: '9px', background: '#EAF1FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TagIcon size={16} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                </div>
                <div style={{ fontSize: '12.5px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div onClick={c.toggle} title={c.toggleTitle} style={css(c.trackStyle)}>
                    <span style={css(c.knobStyle)}></span>
                  </div>
                  <span style={css(c.statusStyle)}>{c.statusLabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                  <button onClick={c.edit} title="Editar categoria" style={css(c.actEditStyle)} className={hv('border-color:#4161FF;background:#EAF1FF;color:#4161FF', undefined, undefined)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path>
                      <path d="M14.5 5.5l4 4" stroke="currentColor" strokeWidth="1.6"></path>
                    </svg>
                  </button>
                  <button onClick={c.toggle} title={c.toggleTitle} style={css(c.actPowerStyle)} className={hv('border-color:#EF4444;background:#FEE9E9;color:#EF4444', undefined, undefined)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3.5v7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
                      <path d="M7.4 6.6a6.6 6.6 0 109.2 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            <div style={css(v.cEmptyStyle)}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="#CBD5E1" strokeWidth="1.8"></circle>
                <path d="M16 16l4.5 4.5" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round"></path>
              </svg>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Nenhuma categoria encontrada</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Ajuste a busca ou o filtro de situação.</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 18px', boxShadow: 'inset 0 1px 0 #EEEEF1', background: '#FFFFFF' }}>
          <div style={{ fontSize: '12px', color: '#64748B' }}>{v.cRangeLabel}</div>
        </div>
      </div>
    </main>
  );
}
