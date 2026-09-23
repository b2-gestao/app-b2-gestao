// Live-mode smoke test without touching the real project: the app is built against a
// fake Supabase URL and every RPC is answered here with synthetic rows shaped like
// the real ones (see supabase/migrations/*_app_rpc_financeiro.sql).
//
//   VITE_SUPABASE_URL=https://fake-project.supabase.co VITE_SUPABASE_ANON_KEY=fake \
//     npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port 4174 &
//   node scripts/smoke-live.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] || 'smoke-live-shots';
const base = process.env.SMOKE_URL || 'http://localhost:4174/';
mkdirSync(out, { recursive: true });

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const days = (from, to) => { const r = []; const [y, m, d] = from.split('-').map(Number); for (let t = new Date(y, m - 1, d); iso(t) <= to; t.setDate(t.getDate() + 1)) r.push(iso(t)); return r; };
const rnd = seed => { let x = seed; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; };

const empresas = [2, 3, 120, 190, 191, 217, 238, 245, 281, 282].map((id, i) => ({
  id, nome: `EMPRESA TESTE ${id} LTDA`, nome_fantasia: id === 2 ? 'Holding Teste' : `SPE Teste ${id}`, cnpj: '00.000.000/0001-00',
  empreendimentos: i % 3 === 0 ? null : `Empreendimento ${String.fromCharCode(65 + i)}`,
}));
const centros = Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, nome: `Centro de custo ${i + 1}`, id_empresa: empresas[i % empresas.length].id }));
const banks = [['341', 'BANCO ITAU'], ['001', 'BANCO DO BRASIL'], ['237', 'BRADESCO'], ['999', 'BANCO REGIONAL XYZ']];
const contas = empresas.flatMap((e, i) => banks.slice(0, 1 + (i % 3)).map(([n, name], j) => ({
  company_id: e.id, company_name: e.nome, bank_number: n, bank_name: name, agency_number: String(1000 + j), account_number: `${e.id}${j}-${i}`, account_name: null, account_type: 'Conta corrente',
})));

function fluxo(p_de, p_ate) {
  const r = rnd(7);
  return days(p_de, p_ate).flatMap(dia => empresas.slice(0, 6).map(e => ({
    company_id: e.id, dia,
    receber_aberto: Math.round(r() * 90000), receber_original: Math.round(r() * 120000),
    pagar_aberto: Math.round(r() * (e.id === 238 ? 300000 : 80000)), pagar_original: Math.round(r() * 100000),
    pagar_quitado: Math.round(r() * 60000), pagar_desconto: Math.round(r() * 900), pagar_correcao: 0,
  })));
}
function pagar(p_de, p_ate) {
  const r = rnd(11);
  return days(p_de, p_ate).flatMap(due_date => empresas.slice(0, 5).flatMap((e, k) => Array.from({ length: 1 + (k % 3) }, (_, j) => ({
    bill_id: 1000 + k * 10 + j, installment_id: 1, company_id: e.id, company_name: e.nome, due_date,
    creditor_name: `Fornecedor ${String.fromCharCode(65 + j + k)}`, document_id: j % 2 ? 'NFE' : 'REC', document_number: String(4000 + j),
    business_area: 'SPE TESTE', balance: Math.round(r() * 50000 + 500), authorized: j % 3 !== 0,
  }))));
}
const seg = () => empresas.slice(0, 6).flatMap((e, i) => ['ADMINISTRAÇÃO', 'CONSTRUÇÃO', 'SPE TESTE', 'Incorporação', 'Comercial', 'Outros'].slice(0, 3 + (i % 3)).map((segmento, j) => ({ company_id: e.id, segmento, total: (j + 1) * 10000 * (6 - i) })));

const usuarios = [{ id: '00000000-0000-0000-0000-000000000001', nome: 'Usuária Teste', email: 'teste@b2.com.br', telefone: null, funcao: 'Administrador', departamento: 'Financeiro', empresas: [2, 3], centros_custo: [100], status: 'ativo' }];

// In-memory PostgREST for the app_* tables (eq/gte/lte filters, insert, upsert, update, delete).
const perms = paths => Object.fromEntries(paths.map(p => [p, { view: true, edit: true }]));
const tables = {
  app_perfis: [
    { id: 'p-adm', nome: 'Administrador', descricao: 'Acesso total', ativo: true, sistema: true, permissoes: {} },
    { id: 'p-fin', nome: 'Analista Financeiro', descricao: 'Financeiro', ativo: true, sistema: false, permissoes: perms(['financeiro.saldos', 'financeiro.lancamentos', 'financeiro.programacao', 'financeiro.fluxo']) },
  ],
  app_departamentos: [{ id: 'd-fin', nome: 'Financeiro', descricao: 'Caixa', ativo: true }, { id: 'd-ti', nome: 'TI', descricao: null, ativo: true }],
  app_saldo_contas_manual: [],
  app_rec_financeiro_lancamento: [],
};
let seq = 1;
function rest(route, name) {
  const req = route.request();
  const url = new URL(req.url());
  const rows = tables[name];
  const filters = [...url.searchParams].filter(([k]) => !['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k));
  const match = r => filters.every(([k, v]) => {
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    return op === 'eq' ? String(r[k]) === val : op === 'gte' ? String(r[k]) >= val : op === 'lte' ? String(r[k]) <= val : true;
  });
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  const m = req.method();
  calls.push(`${m} ${name}`);
  if (m === 'GET') return json(200, rows.filter(match));
  if (m === 'POST') {
    const body = [].concat(req.postDataJSON());
    const conflict = url.searchParams.get('on_conflict');
    for (const b of body) {
      const keys = conflict ? conflict.split(',') : null;
      const cur = keys && rows.find(r => keys.every(k => String(r[k]) === String(b[k])));
      if (cur) Object.assign(cur, b, { atualizado_em: new Date().toISOString() });
      else rows.push({ id: b.id || `id${seq++}`, atualizado_em: new Date().toISOString(), ...b });
    }
    return json(201);
  }
  if (m === 'PATCH') { rows.filter(match).forEach(r => Object.assign(r, req.postDataJSON())); return json(204); }
  if (m === 'DELETE') { tables[name] = rows.filter(r => !match(r)); return json(204); }
  return json(405, {});
}

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'teste@b2.com.br', user_metadata: { full_name: 'Usuária Teste' }, app_metadata: {} };
const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated' })}.sig`, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const calls = [];
page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('sb-fake-project-auth-token', s), JSON.stringify(session));
await page.route(/ipapi\.co|open-meteo|images\.unsplash|api\.bcb\.gov\.br/, r => r.abort());
await page.route('https://fake-project.supabase.co/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/rest/v1/app_usuarios') {
    calls.push('select app_usuarios');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usuarios) });
  }
  const table = url.pathname.match(/^\/rest\/v1\/(app_perfis|app_departamentos|app_saldo_contas_manual|app_rec_financeiro_lancamento)$/);
  if (table) return rest(route, table[1]);
  if (url.pathname === '/functions/v1/app-indicadores') {
    calls.push('fn app-indicadores');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ indicadores: { SELIC: { valor: 15, data: '01/09/2026' }, CDI: { valor: 14.9, data: '22/09/2026' }, IPCA: { valor: 0.31, data: '01/08/2026' }, 'IGP-M': null, 'INCC-M': { valor: 0.42, data: '01/08/2026' } } }) });
  }
  if (url.pathname === '/functions/v1/app-ia') {
    calls.push('fn app-ia');
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'IA não configurada' }) });
  }
  if (url.pathname === '/functions/v1/app-usuarios') {
    const b = route.request().postDataJSON();
    calls.push('fn app-usuarios:' + b.acao);
    if (b.acao === 'convidar') usuarios.push({ id: 'u' + usuarios.length, nome: b.nome, email: b.email, telefone: b.telefone, funcao: b.funcao, departamento: b.departamento, empresas: b.empresas, centros_custo: b.centros_custo, status: 'pendente' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  }
  const fn = url.pathname.split('/rpc/')[1];
  const body = route.request().postDataJSON?.() || {};
  calls.push(fn);
  const data = fn === 'app_empresas' ? empresas : fn === 'app_centros_custo' ? centros : fn === 'app_contas_correntes' ? contas
    : fn === 'app_fluxo_diario' ? fluxo(body.p_de, body.p_ate) : fn === 'app_pagar_periodo' ? pagar(body.p_de, body.p_ate)
      : fn === 'app_pagar_segmentos' ? seg() : fn === 'app_ultimo_sync' ? new Date().toISOString()
        : fn === 'app_pagos_diario' ? days(body.p_de, body.p_ate).map(dia => ({ company_id: 190, dia, pago: 50000, juros: 750, correcao: 0, desconto: 300 }))
        : fn === 'app_is_member' || fn === 'app_is_admin' ? true : null;
  if (!fn) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/00-home.png` });
const clickText = async (t) => { await page.getByText(t, { exact: true }).first().click(); await page.waitForTimeout(900); };
await clickText('Financeiro');
await page.screenshot({ path: `${out}/01-dashboard.png`, fullPage: true });
for (const [t, f] of [['Saldos bancários', '02-saldos'], ['Lançamentos manuais', '03-lancamentos'], ['Programação do dia', '04-programacao'], ['Fluxo de caixa', '05-fluxo']]) {
  await clickText(t);
  await page.screenshot({ path: `${out}/${f}.png` });
}
// Type an opening balance and check it flows into Programação do dia.
await clickText('Saldos bancários');
await page.getByText('Informar saldo', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByPlaceholder('0,00').fill('150.000,00');
await page.getByText('Salvar saldo', { exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/06-saldo-salvo.png` });
if (tables.app_saldo_contas_manual.length !== 1 || Number(tables.app_saldo_contas_manual[0].saldo) !== 150000) errors.push('Saldo não foi gravado em app_saldo_contas_manual: ' + JSON.stringify(tables.app_saldo_contas_manual));
// A monthly recurrence of 3 installments becomes 3 rows with the same grupo_id.
await clickText('Lançamentos manuais');
await clickText('Novo lançamento');
await page.getByPlaceholder('Ex.: VMD – unidade 1803').fill('Aluguel escritório');
await page.locator('input[placeholder="0,00"]:visible').fill('1.234,56');
await page.locator('button:visible', { hasText: /^Nenhuma$/ }).first().click();
await page.waitForTimeout(200);
await page.locator('div:visible > span', { hasText: /^Mensal$/ }).last().click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/06a-rec.png` });
await page.locator('input[type="number"]:visible').fill('3');
await page.locator('button:visible', { hasText: /Salvar lançamento/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/06b-lancamento-recorrente.png` });
const lanc = tables.app_rec_financeiro_lancamento;
if (lanc.length !== 3 || new Set(lanc.map(l => l.grupo_id)).size !== 1 || lanc.map(l => l.parcela).join() !== '1,2,3') errors.push('Recorrência não gerou 3 parcelas: ' + JSON.stringify(lanc));
await clickText('Programação do dia');
await page.getByText('Ver análise', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/07-ia-prog.png` });
await page.mouse.click(8, 8); // close the insights panel (click on the backdrop)
await page.waitForTimeout(300);
// Invite a user: goes to the app-usuarios edge function and shows up in the list.
await clickText('Configurações');
await clickText('Usuários');
await clickText('Novo usuário');
await page.getByPlaceholder('Ex.: Camila Duarte Ribeiro').fill('Pessoa Convidada');
await page.getByPlaceholder('nome@horizonte.com.br').fill('convidada@b2.com.br');
await page.getByText('Cadastrar usuário', { exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/08-usuario-convidado.png` });
if (!(await page.getByText('convidada@b2.com.br').count())) errors.push('Convidado não apareceu na lista');
// Login screen (no session).
const login = await browser.newPage({ viewport: { width: 1440, height: 900 } });
login.on('pageerror', e => errors.push(String(e)));
await login.route(/images\.unsplash/, r => r.abort());
await login.route('https://fake-project.supabase.co/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }) }));
await login.goto(base, { waitUntil: 'networkidle' });
await login.waitForTimeout(500);
await login.screenshot({ path: `${out}/09a-login.png` });
await login.locator('input[type=email]').click();
await login.keyboard.type('pessoa@empresa.com.br');
await login.locator('input[type=password]').click();
await login.keyboard.type('errada123');
await login.keyboard.press('Enter');
await login.waitForTimeout(900);
await login.screenshot({ path: `${out}/09-login.png` });
if (!(await login.getByText('E-mail ou senha incorretos.').count())) errors.push('Login: mensagem de erro não apareceu');
await browser.close();
console.log('RPCs called:', [...new Set(calls)].join(', '));
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('OK — no console errors');
