import { useState, type ReactNode, type KeyboardEvent } from 'react';
import { css, hv } from '../dc/runtime';
import './login.css';

// Port of project/SaaS Login.dc.html (same markup and inline styles). The prototype's
// sample tenant, fake service status, 2FA note and footer links were left out; the
// behavior (sign in, forgot password, set password, access denied) lives in AuthGate.

const BG_URL = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=70';
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fieldStyle = (on: boolean, filled: boolean) => `position:relative;display:block;padding:${filled || on ? '22px 44px 9px 14px' : '17px 44px 17px 14px'};border-radius:12px;border:1px solid ${on ? 'rgba(138,160,255,.8)' : 'rgba(245,245,247,.16)'};background:${on ? 'rgba(65,97,255,.1)' : 'rgba(245,245,247,.045)'};box-shadow:${on ? '0 0 0 4px rgba(65,97,255,.16)' : 'none'};cursor:text;transition:border-color .2s,background .2s,box-shadow .2s,padding .2s ease`;
const labelStyle = (on: boolean, filled: boolean) => `position:absolute;left:15px;right:44px;top:${filled || on ? '8px' : '50%'};transform:${filled || on ? 'none' : 'translateY(-50%)'};font-size:${filled || on ? '10.5px' : '13.5px'};letter-spacing:${filled || on ? '.05em' : '0'};text-transform:${filled || on ? 'uppercase' : 'none'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${on ? '#B3C1FF' : 'rgba(245,245,247,.55)'};pointer-events:none;transition:all .2s cubic-bezier(.16,1,.3,1)`;
const inputStyle = 'width:100%;border:none;outline:none;background:transparent;color:#F5F5F7;font-size:14.5px;font-family:inherit;padding:0';

export type Status = 'idle' | 'loading' | 'done';

/** Background, header and hero copy around the card. */
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="b2-login" style={css('position:relative;min-height:100vh;width:100%;overflow:hidden;background:#0D0E16;display:flex;flex-direction:column;color:#F5F5F7;font-family:"Inter",system-ui,sans-serif')}>
      <div style={css(`position:absolute;inset:-8%;background:#2E3346 url('${BG_URL}') center/cover no-repeat;animation:lgKenBurns 46s ease-in-out infinite;will-change:transform`)}></div>
      <div style={css('position:absolute;inset:0;background:linear-gradient(104deg,rgba(8,9,15,.92) 0%,rgba(9,10,17,.7) 42%,rgba(9,10,17,.34) 72%,rgba(9,10,17,.6) 100%)')}></div>
      <div style={css('position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 120%,rgba(8,9,15,.8),transparent 65%)')}></div>
      <div style={css('position:absolute;top:-16%;left:-8%;width:52vw;height:52vw;border-radius:50%;background:radial-gradient(circle,rgba(65,97,255,.34),transparent 62%);filter:blur(28px);animation:lgOrbDrift 24s ease-in-out infinite;pointer-events:none')}></div>
      <div style={css('position:absolute;bottom:-22%;right:-10%;width:46vw;height:46vw;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.3),transparent 62%);filter:blur(30px);animation:lgOrbDrift2 31s ease-in-out infinite;pointer-events:none')}></div>
      <div style={css('position:absolute;top:34%;right:24%;width:26vw;height:26vw;border-radius:50%;background:radial-gradient(circle,rgba(67,185,151,.2),transparent 64%);filter:blur(26px);animation:lgOrbDrift 38s ease-in-out infinite;pointer-events:none')}></div>
      <div style={css('position:absolute;inset:0;background-image:linear-gradient(rgba(245,245,247,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(245,245,247,.045) 1px,transparent 1px);background-size:38px 38px;animation:lgGridDrift 34s linear infinite;mask-image:radial-gradient(90% 70% at 50% 40%,#000,transparent 78%);-webkit-mask-image:radial-gradient(90% 70% at 50% 40%,#000,transparent 78%);pointer-events:none')}></div>

      <header style={css('position:relative;z-index:2;display:flex;align-items:center;gap:12px;padding:26px 36px;opacity:0;animation:lgFadeIn .6s ease-out .05s both')}>
        <div style={css('width:32px;height:32px;border-radius:9px;background:#4161FF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12.5px;color:#FFFFFF;box-shadow:0 6px 18px rgba(65,97,255,.35)')}>B2</div>
        <div style={css('font-size:14px;font-weight:600;letter-spacing:.01em;color:#F5F5F7')}>B2 Gestão e Operações</div>
      </header>

      <div style={css('position:relative;z-index:2;flex:1;display:flex;align-items:center;justify-content:center;gap:72px;flex-wrap:wrap;padding:12px 36px 40px')}>
        <div style={css('flex:1 1 380px;max-width:520px;min-width:280px;opacity:0;animation:lgFadeUp .7s cubic-bezier(.16,1,.3,1) .1s both')}>
          <div style={css('display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:20px;border:1px solid rgba(245,245,247,.16);background:rgba(20,21,28,.5);backdrop-filter:blur(10px);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:rgba(245,245,247,.7)')}>Plataforma corporativa</div>
          <h1 style={css('margin:22px 0 0;font-size:clamp(30px,4.4vw,50px);line-height:1.06;font-weight:600;letter-spacing:-.025em;color:#FFFFFF;text-wrap:pretty')}>Toda a operação<br />em um só acesso.</h1>
          <p style={css('margin:18px 0 0;font-size:15.5px;line-height:1.65;color:rgba(245,245,247,.72);max-width:44ch;text-wrap:pretty')}>Financeiro, obras, vendas e cobrança das suas empresas — reunidos em um único painel, com o contexto de cada dia.</p>
        </div>
        <div style={css('flex:0 1 424px;min-width:300px;max-width:440px;opacity:0;animation:lgFadeUp .7s cubic-bezier(.16,1,.3,1) .2s both')}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Glass card with the sweep line, title and date. `shakeKey` changes replay the shake. */
export function LoginCard({ title, subtitle, shakeKey, children }: { title: string; subtitle: string; shakeKey: number; children: ReactNode }) {
  return (
    <div key={shakeKey} style={css(`position:relative;overflow:hidden;padding:30px 28px;border-radius:20px;border:1px solid rgba(245,245,247,.14);background:rgba(16,17,24,.66);backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2);box-shadow:0 30px 80px rgba(4,5,10,.6),inset 0 1px 0 rgba(255,255,255,.08);animation:${shakeKey ? 'lgShake .42s ease-out' : 'none'}`)}>
      <div style={css('position:absolute;top:0;left:0;right:0;height:1px;overflow:hidden')}>
        <div style={css('width:34%;height:100%;background:linear-gradient(90deg,transparent,rgba(138,160,255,.95),transparent);animation:lgSweep 5.4s ease-in-out infinite')}></div>
      </div>
      <div style={css('display:flex;align-items:center;gap:10px')}>
        <div style={css('font-size:21px;font-weight:600;letter-spacing:-.015em;color:#FFFFFF')}>{title}</div>
        <div style={css('margin-left:auto;font-size:11.5px;color:rgba(245,245,247,.5)')}>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>
      <div style={css('font-size:13.5px;color:rgba(245,245,247,.66);margin-top:6px')}>{subtitle}</div>
      <div style={css('display:flex;flex-direction:column;gap:14px;margin-top:24px')}>
        {children}
        <div style={css('display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11.5px;color:rgba(245,245,247,.46)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}><rect x="4.5" y="10" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10V7.5a4 4 0 018 0V10" stroke="currentColor" strokeWidth="1.7" /></svg>
          Conexão protegida
        </div>
      </div>
    </div>
  );
}

/** Floating-label field (e-mail or password with show/hide). */
export function LoginField({ label, value, onChange, type, autoComplete, placeholder, onEnter, valid }: {
  label: string; value: string; onChange: (v: string) => void; type: 'email' | 'password';
  autoComplete: string; placeholder: string; onEnter: () => void; valid?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const filled = value.length > 0;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') onEnter(); };
  return (
    <label style={css(fieldStyle(focus, filled))}>
      <span style={css(labelStyle(focus, filled))}>{label}</span>
      <input
        type={type === 'password' && !show ? 'password' : type === 'password' ? 'text' : 'email'}
        value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onKeyDown={onKey}
        autoComplete={autoComplete} placeholder={focus ? placeholder : ''}
        style={css(type === 'password' ? inputStyle.replace('font-family:inherit;', 'font-family:inherit;letter-spacing:.02em;') : inputStyle)}
      />
      {type === 'email' ? (
        <span style={css(`position:absolute;right:14px;top:50%;transform:translateY(-50%) scale(${valid ? 1 : .6});opacity:${valid ? 1 : 0};transition:opacity .2s,transform .2s cubic-bezier(.16,1,.3,1);pointer-events:none;display:flex`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 13l4.2 4.2L19 7.5" stroke="#43B997" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      ) : (
        <span onClick={e => { e.preventDefault(); setShow(v => !v); }} title={show ? 'Ocultar senha' : 'Mostrar senha'} style={css('position:absolute;right:11px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(245,245,247,.6);transition:color .16s,background .16s')} className={hv('color:#F5F5F7;background:rgba(245,245,247,.08)')}>
          {!show
            ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" /></svg>
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M9.6 6c.8-.2 1.6-.3 2.4-.3 5.5 0 9.5 6.3 9.5 6.3s-1.2 1.9-3.2 3.6M6.4 7.9C4 9.7 2.5 12 2.5 12S6.5 18.3 12 18.3c1.3 0 2.5-.3 3.6-.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
        </span>
      )}
    </label>
  );
}

/** Password strength meter shown under a new password. */
export function StrengthMeter({ pwd }: { pwd: string }) {
  let n = 0;
  if (pwd.length >= 6) n++;
  if (pwd.length >= 10) n++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) n++;
  if (/[0-9]/.test(pwd)) n++;
  if (/[^A-Za-z0-9]/.test(pwd)) n++;
  const levels = [
    { l: 'Fraca', c: '#F87171', w: 22 }, { l: 'Fraca', c: '#F87171', w: 28 }, { l: 'Média', c: '#F59E0B', w: 56 },
    { l: 'Boa', c: '#43B997', w: 80 }, { l: 'Forte', c: '#43B997', w: 100 },
  ];
  const lv = levels[Math.min(n, 4)];
  return (
    <div style={css(`display:flex;align-items:center;gap:10px;height:${pwd ? '14px' : '0px'};opacity:${pwd ? 1 : 0};overflow:hidden;transition:height .22s ease,opacity .22s ease`)}>
      <div style={css('flex:1;height:3px;border-radius:99px;background:rgba(245,245,247,.12);overflow:hidden')}>
        <div style={css(`height:100%;border-radius:99px;background:${lv.c};width:${pwd ? lv.w : 0}%;transition:width .3s ease,background .3s ease`)}></div>
      </div>
      <span style={css(`font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:${lv.c};min-width:38px`)}>{lv.l}</span>
    </div>
  );
}

/** Error (red) or info (green) message box. */
export function LoginMessage({ text, ok }: { text: string; ok?: boolean }) {
  const c = ok ? '#6FE3C4' : '#F87171';
  return (
    <div style={css(`display:${text ? 'flex' : 'none'};align-items:center;gap:8px;font-size:12.5px;color:${c};background:${ok ? 'rgba(67,185,151,.1)' : 'rgba(248,113,113,.1)'};border:1px solid ${ok ? 'rgba(67,185,151,.3)' : 'rgba(248,113,113,.28)'};border-radius:10px;padding:9px 11px;animation:lgFadeIn .2s ease-out both`)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.7" /><path d={ok ? 'M8 12.5l2.8 2.8L16.5 9.5' : 'M12 7.5v5.5M12 16.2v.6'} stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {text}
    </div>
  );
}

/** Primary button with idle / loading (+ progress bar) / done states. */
export function LoginButton({ status, label, loadingLabel, doneLabel, onClick }: { status: Status; label: string; loadingLabel: string; doneLabel: string; onClick: () => void }) {
  return (
    <>
      <button type="button" onClick={onClick} style={css(`width:100%;margin-top:4px;padding:14px;border-radius:11px;border:none;font-family:inherit;font-size:14.5px;font-weight:600;color:#FFFFFF;cursor:${status === 'idle' ? 'pointer' : 'default'};background:${status === 'done' ? 'linear-gradient(135deg,#43B997,#2F9B7C)' : 'linear-gradient(135deg,#4161FF,#5B47F0)'};box-shadow:0 10px 26px rgba(65,97,255,.3);transition:filter .18s,box-shadow .2s,transform .12s,background .3s`)} className={hv('filter:brightness(1.08);box-shadow:0 14px 34px rgba(65,97,255,.42)', 'transform:scale(.985)')}>
        {status === 'idle' ? (
          <span style={css('display:flex;align-items:center;justify-content:center;gap:9px')}>
            {label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        ) : status === 'loading' ? (
          <span style={css('display:flex;align-items:center;justify-content:center;gap:10px')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin .85s linear infinite' }}><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.3)" strokeWidth="2.4" /><path d="M21 12a9 9 0 00-9-9" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" /></svg>
            {loadingLabel}
          </span>
        ) : (
          <span style={css('display:flex;align-items:center;justify-content:center;gap:9px;animation:lgCheckIn .3s cubic-bezier(.16,1,.3,1) both')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 13l4.2 4.2L19 7.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {doneLabel}
          </span>
        )}
      </button>
      <div style={css(`height:${status === 'loading' ? '3px' : '0px'};opacity:${status === 'loading' ? 1 : 0};border-radius:99px;background:rgba(245,245,247,.1);overflow:hidden;transition:height .2s,opacity .2s`)}>
        <div style={css('height:100%;border-radius:99px;background:linear-gradient(90deg,#4161FF,#7C3AED,#43B997);animation:lgBarGrow 1.25s cubic-bezier(.3,.9,.2,1) both')}></div>
      </div>
    </>
  );
}

/** "Manter conectado" checkbox + "Esqueci minha senha" link row. */
export function RememberRow({ remember, onToggle, onForgot }: { remember: boolean; onToggle: () => void; onForgot: () => void }) {
  return (
    <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px')}>
      <div onClick={onToggle} style={css('display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none')}>
        <span style={css(`width:17px;height:17px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;border:1px solid ${remember ? '#4161FF' : 'rgba(245,245,247,.3)'};background:${remember ? '#4161FF' : 'transparent'};transition:background .18s,border-color .18s`)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={css(`opacity:${remember ? 1 : 0};transform:scale(${remember ? 1 : .5});transition:opacity .16s,transform .16s cubic-bezier(.16,1,.3,1)`)}><path d="M5 13l4.2 4.2L19 7.5" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span style={css('font-size:12.5px;color:rgba(245,245,247,.72)')}>Manter conectado</span>
      </div>
      <a href="#" onClick={e => { e.preventDefault(); onForgot(); }} style={css('font-size:12.5px')}>Esqueci minha senha</a>
    </div>
  );
}

export { MAIL_RE };
