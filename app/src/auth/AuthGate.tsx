import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, passwordLinkType } from '../lib/supabase';
import { usuariosApi } from '../lib/api';
import App from '../App';
import { LoginShell, LoginCard, LoginField, LoginMessage, LoginButton, RememberRow, StrengthMeter, MAIL_RE, type Status } from './LoginScreen';

/**
 * Requires a Supabase Auth session and an active record in app_usuarios before
 * showing the app. Also handles the invite / password-recovery e-mail links by asking
 * for a new password. Without Supabase configured, the app opens in demo mode.
 * Screens follow the "SaaS Login" design (LoginScreen.tsx).
 */
export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [needsPassword, setNeedsPassword] = useState<'invite' | 'recovery' | null>(passwordLinkType);
  const [member, setMember] = useState<'checking' | 'yes' | 'no' | 'error'>('checking');
  const [memberErr, setMemberErr] = useState('');

  useEffect(() => {
    if (!supabase) return;
    applyRememberChoice().then(() => supabase!.auth.getSession()).then(({ data }) => {
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
      <Blocked email={session.user.email || ''} text={member === 'error'
        ? `Não foi possível verificar seu acesso (${memberErr}).`
        : 'Seu login existe, mas não há cadastro ativo para você no sistema. Peça a um administrador para liberar seu acesso em Configurações › Usuários.'} />
    );
  }
  return <App session={session} />;
}

// ---------- screens (design: project/SaaS Login.dc.html, see LoginScreen.tsx) ----------
const REMEMBER_KEY = 'b2_manter_conectado';
const ALIVE_KEY = 'b2_sessao_ativa';

/** "Manter conectado" off: the session ends when the browser is closed. */
async function applyRememberChoice() {
  try {
    if (localStorage.getItem(REMEMBER_KEY) === '0' && !sessionStorage.getItem(ALIVE_KEY)) await supabase?.auth.signOut();
  } catch { /* storage blocked */ }
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [remember, setRemember] = useState(() => { try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; } });
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shake, setShake] = useState(0);
  const fail = (text: string) => { setMsg({ ok: false, text }); setStatus('idle'); setShake(k => k + 1); };

  const submit = async () => {
    if (status !== 'idle') return;
    if (!MAIL_RE.test(email.trim())) return fail('Informe um e-mail corporativo válido.');
    if (!pwd) return fail('Informe sua senha.');
    setStatus('loading');
    setMsg(null);
    try {
      localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
      sessionStorage.setItem(ALIVE_KEY, '1');
    } catch { /* storage blocked */ }
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password: pwd });
    if (error) return fail(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    setStatus('done');
  };
  const forgot = async () => {
    if (!MAIL_RE.test(email.trim())) return fail('Digite seu e-mail acima para receber o link de redefinição.');
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.' });
  };

  return (
    <LoginShell>
      <LoginCard title="Entrar" subtitle="Use suas credenciais corporativas." shakeKey={shake}>
        <LoginField label="E-mail corporativo" type="email" value={email} onChange={v => { setEmail(v); setMsg(null); }} autoComplete="username" placeholder="nome@empresa.com.br" onEnter={submit} valid={MAIL_RE.test(email.trim())} />
        <LoginField label="Senha" type="password" value={pwd} onChange={v => { setPwd(v); setMsg(null); }} autoComplete="current-password" placeholder="••••••••" onEnter={submit} />
        <LoginMessage text={msg?.text || ''} ok={msg?.ok} />
        <RememberRow remember={remember} onToggle={() => setRemember(r => !r)} onForgot={forgot} />
        <LoginButton status={status} label="Entrar" loadingLabel="Verificando acesso" doneLabel="Acesso liberado" onClick={submit} />
      </LoginCard>
    </LoginShell>
  );
}

function SetPassword({ kind, onDone }: { kind: 'invite' | 'recovery'; onDone: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [shake, setShake] = useState(0);
  const fail = (t: string) => { setError(t); setStatus('idle'); setShake(k => k + 1); };

  const submit = async () => {
    if (status !== 'idle') return;
    if (p1.length < 8) return fail('Use pelo menos 8 caracteres.');
    if (p1 !== p2) return fail('As senhas não conferem.');
    setStatus('loading');
    const { error: err } = await supabase!.auth.updateUser({ password: p1 });
    if (err) return fail(err.message);
    setStatus('done');
    setTimeout(onDone, 700);
  };

  return (
    <LoginShell>
      <LoginCard title={kind === 'invite' ? 'Defina sua senha' : 'Redefinir senha'} subtitle={kind === 'invite' ? 'Bem-vindo(a)! Crie a senha do seu primeiro acesso.' : 'Escolha uma nova senha de acesso.'} shakeKey={shake}>
        <LoginField label="Nova senha" type="password" value={p1} onChange={v => { setP1(v); setError(''); }} autoComplete="new-password" placeholder="mínimo 8 caracteres" onEnter={submit} />
        <StrengthMeter pwd={p1} />
        <LoginField label="Confirmar senha" type="password" value={p2} onChange={v => { setP2(v); setError(''); }} autoComplete="new-password" placeholder="repita a senha" onEnter={submit} />
        <LoginMessage text={error} />
        <LoginButton status={status} label="Salvar senha" loadingLabel="Salvando" doneLabel="Senha definida" onClick={submit} />
      </LoginCard>
    </LoginShell>
  );
}

function Blocked({ email, text }: { email: string; text: string }) {
  return (
    <LoginShell>
      <LoginCard title="Acesso não liberado" subtitle={email} shakeKey={0}>
        <LoginMessage text={text} />
        <LoginButton status="idle" label="Sair" loadingLabel="" doneLabel="" onClick={() => supabase!.auth.signOut()} />
      </LoginCard>
    </LoginShell>
  );
}
