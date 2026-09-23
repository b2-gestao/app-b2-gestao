// Smoke test: opens every screen, fails on console errors, saves screenshots.
//   npm run build && npx vite preview --port 4173 &  node scripts/smoke.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] || 'smoke-shots';
const base = process.env.SMOKE_URL || 'http://localhost:4173/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
// Keep the smoke test offline: stub the weather / IP lookups.
await page.route(/ipapi\.co|open-meteo|images\.unsplash|api\.bcb\.gov\.br/, r => r.abort());

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/00-home.png` });

const clickText = async (t) => { await page.getByText(t, { exact: true }).first().click(); await page.waitForTimeout(700); };
await clickText('Financeiro');
await page.screenshot({ path: `${out}/01-dashboard.png` });
const pages = [['Saldos bancários', '02-saldos'], ['Lançamentos manuais', '03-lancamentos'], ['Programação do dia', '04-programacao'], ['Fluxo de caixa', '05-fluxo']];
for (const [t, f] of pages) { await clickText(t); await page.screenshot({ path: `${out}/${f}.png` }); }
await clickText('Configurações');
for (const [t, f] of [['Usuários', '06-usuarios'], ['Departamentos', '07-departamentos'], ['Perfis', '08-perfis']]) { await clickText(t); await page.screenshot({ path: `${out}/${f}.png` }); }
await clickText('Usuários');
await clickText('Novo usuário');
await page.screenshot({ path: `${out}/09-user-modal.png` });
await browser.close();
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('OK — no console errors');
