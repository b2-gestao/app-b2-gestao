import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, passwordLinkType } from '../lib/supabase';
import { usuariosApi } from '../lib/api';
import App from '../App';

/**
 * Requires a Supabase Auth session and an active record in app_usuarios before
 * showing the app. Also handles the invite / password-recovery e-mail links by asking
 * for a new password. Without Supabase configured, the app opens in demo mode.
 * The screens here are minimal; the full "SaaS Login" design is a separate screen.
 */
export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [needsPassword, setNeedsPassword] = useState<'invite' | 'recovery' | null>(passwordLinkType);
  const [member, setMember] = useState<'checking' | 'yes' | 'no' | 'error'>('checking');
  const [memberErr, setMemberErr] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword('recovery');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    setMember('checking');
    usuariosApi.souMembro()
      .then(ok => setMember(ok ? 'yes' : 'no'))
      .catch(e => { setMemberErr(e.message); setMember('error'); });
  }, [userId]);

  if (!ready) return null;
  if (!supabase) return <App session={null} />;
  if (!session) return <SignIn />;
  if (needsPassword) return <SetPassword kind={needsPassword} onDone={() => { history.replaceState(null, '', location.pathname); setNeedsPassword(null); }} />;
  if (member === 'checking') return null;
  if (member !== 'yes') {
    return (
      <Card title="Acesso não liberado" subtitle={session.user.email || ''}>
        <div style={{ fontSize: 13, color: 'rgba(245,245,247,.78)', lineHeight: 1.5 }}>
          {member === 'error'
            ? `Não foi possível verificar seu acesso (${memberErr}).`
            : 'Seu login existe, mas não há cadastro ativo para você no sistema. Peça a um administrador para liberar seu acesso em Configurações › Usuários.'}
        </div>
        <button onClick={() => supabase!.auth.signOut()} style={btn}>Sair</button>
      </Card>
    );
  }
  return <App session={session} />;
}

// ---------- shared look (same palette as the home screen) ----------
const field: CSSProperties = {
  height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(245,245,247,.18)',
  background: 'rgba(20,21,28,.55)', color: '#F5F5F7', fontSize: 13.5, fontFamily: 'inherit',
};
const label: CSSProperties = { fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(245,245,247,.6)', fontWeight: 600 };
const btn: CSSProperties = { height: 40, border: 'none', borderRadius: 9, background: '#4161FF', color: '#FFFFFF', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(65,97,255,.3)' };
const link: CSSProperties = { alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, color: '#93A4FF', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' };

function Card({ title, subtitle, children, onSubmit }: { title: string; subtitle: string; children: ReactNode; onSubmit?: (e: FormEvent) => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#161826 radial-gradient(1200px 600px at 20% 10%, rgba(65,97,255,.22), transparent 60%)' }}>
      <form onSubmit={onSubmit || (e => e.preventDefault())} style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16, padding: 28, borderRadius: 14, background: 'rgba(24,26,40,.9)', boxShadow: '0 0 0 1px rgba(245,245,247,.12), 0 30px 70px rgba(0,0,0,.4)', animation: 'modalIn .3s cubic-bezier(.16,1,.3,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#4161FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, color: '#FFFFFF' }}>B2</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F7' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'rgba(245,245,247,.6)' }}>{subtitle}</div>
          </div>
        </div>
        {children}
      </form>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message });
  };
  const forgot = async () => {
    if (!/.+@.+\..+/.test(email.trim())) { setMsg({ ok: false, text: 'Digite seu e-mail acima para receber o link.' }); return; }
    setBusy(true);
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.' });
  };

  return (
    <Card title="B2 Gestão e Operações" subtitle="Entre para continuar" onSubmit={submit}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>E-mail</span>
        <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Senha</span>
        <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required style={field} />
      </label>
      {msg ? <div style={{ fontSize: 12.5, color: msg.ok ? '#6FE3C4' : '#FCA5A5' }}>{msg.text}</div> : null}
      <button type="submit" disabled={busy} style={btn}>{busy ? 'Aguarde…' : 'Entrar'}</button>
      <button type="button" onClick={forgot} disabled={busy} style={link}>Esqueci minha senha</button>
    </Card>
  );
}

function SetPassword({ kind, onDone }: { kind: 'invite' | 'recovery'; onDone: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (p1.length < 8) { setError('Use pelo menos 8 caracteres.'); return; }
    if (p1 !== p2) { setError('As senhas não conferem.'); return; }
    setBusy(true);
    const { error: err } = await supabase!.auth.updateUser({ password: p1 });
    setBusy(false);
    if (err) setError(err.message); else onDone();
  };

  return (
    <Card title={kind === 'invite' ? 'Bem-vindo(a)!' : 'Redefinir senha'} subtitle={kind === 'invite' ? 'Defina sua senha de acesso' : 'Escolha uma nova senha'} onSubmit={submit}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Nova senha</span>
        <input type="password" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} required style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Confirmar senha</span>
        <input type="password" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} required style={field} />
      </label>
      {error ? <div style={{ fontSize: 12.5, color: '#FCA5A5' }}>{error}</div> : null}
      <button type="submit" disabled={busy} style={btn}>{busy ? 'Salvando…' : 'Salvar senha'}</button>
    </Card>
  );
}
