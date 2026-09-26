import type { AppLogic } from './AppLogic';
import type { ContaCorrente } from '../lib/api';
import { baixarCsv } from '../lib/download';

// Saldos bancários in live mode: accounts come from contas_correntes (Sienge);
// opening balances are typed in or imported from the CSV template and saved in
// app_saldo_contas_manual (see data.ts).

const BANKS: Record<string, { name: string; c: string; s: string }> = {
  '001': { name: 'Banco do Brasil', c: '#B38B00', s: 'BB' },
  '033': { name: 'Santander', c: '#E30613', s: 'SA' },
  '041': { name: 'Banrisul', c: '#0060AE', s: 'BS' },
  '070': { name: 'BRB', c: '#005CA9', s: 'BRB' },
  '077': { name: 'Inter', c: '#FF7A00', s: 'IN' },
  '104': { name: 'Caixa', c: '#005CA9', s: 'CX' },
  '208': { name: 'BTG Pactual', c: '#0B2A4A', s: 'BT' },
  '237': { name: 'Bradesco', c: '#CC092F', s: 'BR' },
  '260': { name: 'Nubank', c: '#820AD1', s: 'NU' },
  '336': { name: 'C6 Bank', c: '#242424', s: 'C6' },
  '341': { name: 'Itaú', c: '#EC7000', s: 'IT' },
  '422': { name: 'Safra', c: '#1D3B6E', s: 'SF' },
  '748': { name: 'Sicredi', c: '#3FA535', s: 'SI' },
  '756': { name: 'Sicoob', c: '#00A091', s: 'SC' },
};
const FALLBACK_COLORS = ['#4161FF', '#43B997', '#7C3AED', '#0EA5E9', '#F59E0B', '#EC4899'];

const titleCase = (t: string) => t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

export function bankMeta(number: string | null, name: string | null) {
  const key = (number || '').replace(/\D/g, '').padStart(3, '0');
  if (BANKS[key]) return BANKS[key];
  const label = titleCase((name || 'Banco').replace(/^banco\s+/i, '').trim()) || 'Banco';
  const s = label.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { name: label, c: FALLBACK_COLORS[h % FALLBACK_COLORS.length], s };
}

export const accountId = (c: ContaCorrente) => `${c.company_id}|${c.bank_number || ''}|${c.agency_number || ''}|${c.account_number || ''}`;

/** Rows in the shape the prototype's Saldos screen expects. */
export function sbLive(app: AppLogic, date: string, onlySelected = true) {
  const sel = new Set<string>(app.state.dbContasSel || []);
  // dbContas already holds only ENABLED accounts (app_contas_correntes); the listing keeps just the added ones.
  const contas: ContaCorrente[] = (app.state.dbContas || []).filter((c: ContaCorrente) => !onlySelected || sel.has(accountId(c)));
  const day = app.readSaldos()[date] || {};
  return contas.map(c => {
    const id = accountId(c);
    const bk = bankMeta(c.bank_number, c.bank_name);
    const inf = day[id];
    return {
      id, cd: c.company_id, emp: app.empresaNome(c.company_id, c.company_name),
      bank: bk.name, bankColor: bk.c, bankShort: bk.s,
      ag: c.agency_number || '—', cc: c.account_number || '—', tipo: c.account_type || '',
      uso: [], saldo: inf ? inf.saldo : null, upd: inf ? inf.upd : '—',
      status: inf ? 'ok' : 'missing',
      origem: inf?.origem, obs: inf?.obs,
    };
  });
}

// Same names as contas_correntes, so every line maps back to an account there.
const CSV_HEAD = ['company_id', 'account_number', 'account_type_description', 'saldo'];

/** Template pre-filled with every ENABLED conta corrente (rows = sbLive(..., false)); the user only fills "saldo". */
export function downloadTemplate(app: AppLogic, rows: any[], date: string) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const f2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  // ="0000088420" keeps Excel from dropping leading zeros / turning the number into 8,8E+04.
  const lines = [CSV_HEAD.join(';')].concat(rows.map(r => [esc(r.cd), `="${String(r.cc).replace(/"/g, '')}"`, esc(r.tipo), esc(r.saldo != null ? f2(r.saldo) : '')].join(';')));
  // ";" is Excel's separator in pt-BR.
  const nome = baixarCsv(lines, `saldos_modelo_${date}.csv`);
  app.toast(`Planilha-modelo baixada · ${nome}`);
}

function parseCsv(text: string): string[][] {
  const sep = (text.split(/\r?\n/)[0].match(/;/g) || []).length >= (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const out: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); out.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(c => c.trim()));
}

const parseBRL = (v: string) => {
  const t = v.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
// Excel may save ="0001" as-is or strip it to 0001; either way keep just the value.
const cell = (v: string | undefined) => String(v ?? '').trim().replace(/^="?|"$/g, '').trim();
const digits = (v: string) => v.replace(/\D/g, '').replace(/^0+/, '');

/**
 * Imports the CSV template (company_id;account_number;account_type_description;saldo).
 * rows = every ENABLED conta corrente; a line only counts if it matches one of them
 * (company_id + account_number, and the type when filled). Matched accounts join the listing.
 */
export async function importCsv(app: AppLogic, file: File, rows: any[], date: string) {
  if (!/\.csv$/i.test(file.name)) {
    app.toast('Use a planilha-modelo em CSV (botão "Baixar modelo").');
    return;
  }
  const text = (await file.text()).replace(/^﻿/, '');
  const table = parseCsv(text);
  const head = (table.shift() || []).map(h => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  if (CSV_HEAD.some(h => col(h) < 0)) {
    app.toast('Cabeçalho inválido. Esperado: ' + CSV_HEAD.join(';'));
    return;
  }
  // (company_id, account_number) is unique among ENABLED accounts.
  const exact = new Map(rows.map(r => [`${r.cd}|${String(r.cc).trim()}`, r]));
  // Fallback when Excel mangled the number (lost zeros): digits only, used only if unambiguous.
  const loose = new Map<string, any[]>();
  rows.forEach(r => {
    const k = `${r.cd}|${digits(String(r.cc))}`;
    loose.set(k, (loose.get(k) || []).concat(r));
  });
  const patch: Record<string, any> = {};
  const unmatched: string[] = [];
  for (const line of table) {
    const saldo = parseBRL(line[col('saldo')] || '');
    if (saldo == null) continue;
    const cd = cell(line[col('company_id')]).replace(/\D/g, ''), cc = cell(line[col('account_number')]), tipo = norm(cell(line[col('account_type_description')]));
    const okTipo = (r: any) => !tipo || norm(r.tipo) === tipo;
    let r = exact.get(`${cd}|${cc}`);
    if (r && !okTipo(r)) r = undefined;
    if (!r) {
      const cands = (loose.get(`${cd}|${digits(cc)}`) || []).filter(okTipo);
      if (cands.length === 1) r = cands[0];
    }
    if (!r) { unmatched.push(`${cd} · ${cc}`); continue; }
    patch[r.id] = { saldo, upd: app.nowStamp(), origem: 'Planilha' };
  }
  const n = Object.keys(patch).length;
  if (n && !(await app.addContasSel(Object.keys(patch)))) return;
  if (n && !(await app.writeSaldos(date, patch))) return;
  const miss = unmatched.length
    ? ` · ${unmatched.length} linha(s) sem conta ativa correspondente em contas_correntes (${unmatched.slice(0, 3).join('; ')}${unmatched.length > 3 ? '…' : ''})`
    : '';
  app.toast(`${file.name} importada · ${n} ${n === 1 ? 'conta atualizada' : 'contas atualizadas'}${miss}.`);
}
