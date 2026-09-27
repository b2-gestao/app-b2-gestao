// "Enviar por e-mail": modal genérico que manda o PDF de uma tela para uma lista de e-mails.
// Not generated from the prototype; same markup as CategoriaModal. Logic: logic/vals/envioEmail.ts.
import { css, hv } from '../dc/runtime';

const label = { fontSize: '11px', fontWeight: 600, color: '#374151' } as const;
const caixa = { padding: '10px 12px', borderRadius: '8px', border: '1px solid #E7E7EA', background: '#FAFAFB', fontSize: '12.5px', color: '#374151' } as const;

export default function EnviarEmailModal({ v }: { v: any }) {
  if (!v.envioEmailOpen) return null;
  const busy = v.envioEmailBusy;
  return (
    <div style={css('display:flex;position:fixed;inset:0;z-index:120;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both')} onClick={v.fecharEnvioEmail}>
      <div onClick={e => e.stopPropagation()} style={css('width:100%;max-width:540px;max-height:92vh;display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 30px 70px rgba(9,10,16,.34);overflow:hidden;animation:modalIn .24s cubic-bezier(.16,1,.3,1) both')}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px 24px 16px', boxShadow: 'inset 0 -1px 0 #EEEEF1' }}>
          <div style={{ width: '38px', height: '38px', flex: 'none', borderRadius: '11px', background: '#EAF1FF', color: '#4161FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 6.5h16v11H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"></path>
              <path d="M4.5 7l7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </div>
          <div style={{ flex: '1', minWidth: '0' }}>
            <div style={{ fontWeight: 700, fontSize: '16.5px', color: '#111827' }}>Enviar por e-mail</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{v.envioEmailTitulo}</div>
          </div>
          <button onClick={v.fecharEnvioEmail} title="Fechar" style={{ width: '30px', height: '30px', flex: 'none', borderRadius: '8px', border: '1px solid #EEEEF1', background: '#FFFFFF', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s,border-color .15s' }} className={hv('background:#F7F7F9;border-color:#D8D8E0', undefined, undefined)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"></path>
            </svg>
          </button>
        </div>

        <div style={{ flex: '1', overflowY: 'auto', padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>De</span>
            <div style={caixa}>{v.envioEmailDe}</div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>Para <span style={{ color: '#EF4444' }}>*</span></span>
            <input
              value={v.envioEmailPara}
              onChange={e => v.setEnvioEmailPara(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') v.enviarEmail(); }}
              placeholder="nome@empresa.com.br; outro@empresa.com.br"
              autoFocus
              disabled={busy}
              style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${v.envioEmailErro ? '#FCA5A5' : '#E7E7EA'}`, background: '#FFFFFF', fontSize: '13px', fontFamily: 'inherit', color: '#111827', outline: 'none' }}
            />
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Separe vários e-mails com vírgula ou ponto e vírgula.</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>Assunto</span>
            <div style={caixa}>{v.envioEmailAssunto}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={label}>Mensagem</span>
            <div style={{ ...caixa, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{v.envioEmailCorpo}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', color: '#DC2626' }}>
              <path d="M7 3.5h7l4 4V20.5H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path>
              <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path>
            </svg>
            Anexo: {v.envioEmailArquivo}
          </div>
          {v.envioEmailErro ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#FEE9E9', color: '#B91C1C', fontSize: '12.5px', fontWeight: 500 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
                <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7"></circle>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
              </svg>
              {v.envioEmailErro}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', background: '#FAFAFB', boxShadow: 'inset 0 1px 0 #EEEEF1' }}>
          <button onClick={v.fecharEnvioEmail} disabled={busy} style={{ height: '38px', padding: '0 16px', borderRadius: '9px', border: '1px solid #E7E7EA', background: '#FFFFFF', color: '#374151', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, transition: 'background .15s,border-color .15s' }} className={hv('background:#F4F4F6;border-color:#D8D8E0', undefined, undefined)}>
            Cancelar
          </button>
          <button onClick={v.enviarEmail} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 18px', border: 'none', borderRadius: '9px', background: '#4161FF', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, boxShadow: '0 4px 14px rgba(65,97,255,.26)', transition: 'background .15s,transform .15s' }} className={hv('background:#3153F4', 'transform:scale(.97)', undefined)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l16-7-6 15-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"></path>
            </svg>
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
