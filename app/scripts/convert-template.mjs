// Converts the Claude Design prototype template (project/SaaS Home.dc.html, <x-dc> block)
// into React TSX components so the markup and inline styles stay pixel-identical.
//
//   node scripts/convert-template.mjs
//
// Output goes to src/screens/generated/*.tsx. Regenerate after editing the prototype;
// do not hand-edit generated files — put behavior in src/logic instead.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFragment } from 'parse5';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../project/SaaS Home.dc.html');
const OUT = join(here, '../src/screens/generated');

const html = readFileSync(SRC, 'utf8');
const start = html.indexOf('<x-dc>') + '<x-dc>'.length;
const end = html.lastIndexOf('</x-dc>');
let tpl = html.slice(start, end);
tpl = tpl.replace(/<helmet[\s\S]*?<\/helmet>/, '');
// The prototype hard-codes a sample tenant and user; bind them to real data instead.
const SUBS = [
  ['>Horizonte Empreendimentos<', '>{{ brandName }}<'],
  ['>Horizonte Empreend.<', '>{{ brandShort }}<'],
  ['>HE<', '>{{ brandInitials }}<'],
  ['>Camila Duarte Ribeiro<', '>{{ userName }}<'],
  // Only the avatar chips — the Saldos table also has a "CD" column header.
  ['color:#FFFFFF">CD<', 'color:#FFFFFF">{{ userInitials }}<'],
  ['>Analista Financeiro Sênior<', '>{{ userRole }}<'],
  ['>Olá, Camila!<', '>Olá, {{ userFirstName }}!<'],
  // Dashboard sample figures → computed values.
  ['>↑ 6,4% vs. ontem<', '>{{ kpiReceberDelta }}<'],
  ['>↓ 2,1% vs. ontem<', '>{{ kpiPagarDelta }}<'],
  ['>↑ 4 movimentações hoje<', '>{{ kpiSaldoSub }}<'],
  ['>18 lançamentos previstos<', '>{{ kpiPrevisaoSub }}<'],
  ['</span>1 parcela vence hoje', '</span>{{ parcelasTodayLabel }}'],
  // Insight banners on Programação do dia / Fluxo de caixa.
  ['>Saldo insuficiente na conta Itaú · Obras Ltda para cobrir os pagamentos de hoje — faltam R$ 18.400<', '>{{ iaProgHeadline }}<'],
  ['>Análise com IA · 3 pontos de atenção na programação de hoje<', '>{{ iaProgSub }}<'],
  ['>Saldo projetado fica negativo em 28/09 · R$ 142 mil abaixo do necessário<', '>{{ iaFluxoHeadline }}<'],
  ['>Análise com IA · projeção dos próximos 10 dias<', '>{{ iaFluxoSub }}<'],
  // Last Sienge sync time.
  ['>Sienge sincronizado às 08:19<', '>{{ syncLabel }}<'],
];
for (const [a, b] of SUBS) tpl = tpl.split(a).join(b);
// Sidebar "Sair" entry gets a handler.
tpl = tpl.replace(/(<div style="margin-top:2px;padding:8px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;color:#F59E0B)/, '<div onClick="{{ signOut }}" style="margin-top:2px;padding:8px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;color:#F59E0B');

const frag = parseFragment(tpl);

// ---------- attribute name mapping ----------
const ATTR_MAP = {
  onclick: 'onClick', onchange: 'onChange', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave',
  autofocus: 'autoFocus', inputmode: 'inputMode', viewbox: 'viewBox', pathlength: 'pathLength',
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength',
};
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function attrName(n) {
  if (ATTR_MAP[n]) return ATTR_MAP[n];
  if (n.startsWith('data-') || n.startsWith('aria-')) return n;
  if (n.includes('-')) return camel(n);
  return n;
}

// ---------- expressions ----------
const LITERALS = new Set(['true', 'false', 'null']);
function expr(raw, scope) {
  let e = raw.trim();
  let neg = '';
  while (e.startsWith('!')) { neg += '!'; e = e.slice(1).trim(); }
  if (LITERALS.has(e) || /^-?\d+(\.\d+)?$/.test(e)) return neg + e;
  if (!/^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(e)) throw new Error('Unsupported expression: ' + raw);
  const head = e.split('.')[0];
  return neg + (scope.includes(head) ? e : 'v.' + e);
}
const BIND = /\{\{([^}]*)\}\}/g;
const isPureBinding = s => /^\s*\{\{[^}]*\}\}\s*$/.test(s);
// Template literal for strings mixing static text and bindings.
function tmpl(s, scope) {
  let out = '`';
  let last = 0;
  for (const m of s.matchAll(BIND)) {
    out += s.slice(last, m.index).replace(/[`\\$]/g, c => '\\' + c);
    out += '${' + expr(m[1], scope) + '}';
    last = m.index + m[0].length;
  }
  out += s.slice(last).replace(/[`\\$]/g, c => '\\' + c) + '`';
  return out;
}

// ---------- CSS text -> style object literal (static) ----------
function splitDecls(css) {
  const out = []; let depth = 0, cur = '';
  for (const ch of css) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}
function cssProp(p) {
  p = p.trim();
  if (p.startsWith('--')) return p;
  if (p.startsWith('-webkit-')) return 'Webkit' + camel(p.slice(8)).replace(/^./, c => c.toUpperCase());
  return camel(p);
}
function staticStyle(css) {
  const parts = splitDecls(css).map(d => {
    const i = d.indexOf(':');
    const k = cssProp(d.slice(0, i));
    const val = d.slice(i + 1).trim();
    return `${JSON.stringify(k)}: ${JSON.stringify(val)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

// ---------- JSX emission ----------
const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
const INLINE = new Set(['span', 'strong', 'a', 'em', 'b', 'i', 'label', 'svg', 'button', 'input']);
const components = []; // { name, jsx }

function getAttr(node, n) { return (node.attrs || []).find(a => a.name === n)?.value; }
function isFlexLike(node) {
  const st = getAttr(node, 'style') || '';
  return /display:\s*(inline-)?(flex|grid)/.test(st) || /\{\{/.test(st);
}
function jsxText(s) {
  if (/[{}<>]/.test(s)) return `{${JSON.stringify(s)}}`;
  return s;
}

function emitAttrs(node, scope) {
  const out = [];
  let hover, active, focus;
  for (const a of node.attrs || []) {
    const { name, value } = a;
    if (name === 'hint-placeholder-val' || name === 'hint-placeholder-count') continue;
    if (name === 'style-hover') { hover = value; continue; }
    if (name === 'style-active') { active = value; continue; }
    if (name === 'style-focus') { focus = value; continue; }
    if (name === 'style') {
      if (isPureBinding(value)) out.push(`style={css(${expr(value.replace(/[{}]/g, ''), scope)})}`);
      else if (value.includes('{{')) out.push(`style={css(${tmpl(value, scope)})}`);
      else out.push(`style={${staticStyle(value)}}`);
      continue;
    }
    const n = attrName(name);
    if (isPureBinding(value)) out.push(`${n}={${expr(value.replace(/[{}]/g, ''), scope)}}`);
    else if (value.includes('{{')) out.push(`${n}={${tmpl(value, scope)}}`);
    else if (n === 'rows') out.push(`rows={${Number(value)}}`);
    else out.push(`${n}=${JSON.stringify(value)}`);
  }
  if (hover || active || focus) {
    const arg = s => s == null ? 'undefined' : (s.includes('{{') ? (isPureBinding(s) ? expr(s.replace(/[{}]/g, ''), scope) : tmpl(s, scope)) : JSON.stringify(s));
    out.push(`className={hv(${arg(hover)}, ${arg(active)}, ${arg(focus)})}`);
  }
  return out.length ? ' ' + out.join(' ') : '';
}

function emitChildren(node, scope, ind) {
  const kids = (node.childNodes || []).filter(c => c.nodeName !== '#comment');
  const flex = isFlexLike(node);
  const parts = [];
  kids.forEach((c, i) => {
    if (c.nodeName === '#text') {
      const raw = c.value;
      if (!raw.trim()) {
        const prev = kids[i - 1], next = kids[i + 1];
        if (!flex && raw.includes('\n') && prev && next && INLINE.has(prev.nodeName) && INLINE.has(next.nodeName)) parts.push(ind + '{" "}');
        else if (!flex && !raw.includes('\n') && prev && next) parts.push(ind + '{" "}');
        return;
      }
      let s = raw.replace(/\s+/g, ' ');
      const lead = s.startsWith(' ') && i > 0 && !flex;
      const trail = s.endsWith(' ') && i < kids.length - 1 && !flex;
      s = s.trim();
      let body = '';
      let last = 0;
      for (const m of s.matchAll(BIND)) {
        const t = s.slice(last, m.index);
        if (t) body += jsxText(t);
        body += `{${expr(m[1], scope)}}`;
        last = m.index + m[0].length;
      }
      const tail = s.slice(last);
      if (tail) body += jsxText(tail);
      // JSX trims whitespace at line edges; keep significant spaces explicit.
      body = body.replace(/^ /, '{" "}').replace(/ $/, '{" "}');
      parts.push(ind + (lead ? '{" "}' : '') + body + (trail ? '{" "}' : ''));
      return;
    }
    parts.push(emit(c, scope, ind));
  });
  return parts.join('\n');
}

// Top-level regions extracted into their own component files.
function extractName(node) {
  if (node.nodeName === 'sc-if') {
    const m = /\{\{\s*(is[A-Z]\w*)\s*\}\}/.exec(getAttr(node, 'value') || '');
    if (m && ['isHome', 'isUsuarios', 'isDepartamentos', 'isPerfis', 'isSaldos', 'isLanc', 'isProg', 'isFluxo', 'isDashboard'].includes(m[1])) {
      return { isHome: 'HomeScreen', isUsuarios: 'UsuariosPage', isDepartamentos: 'DepartamentosPage', isPerfis: 'PerfisPage', isSaldos: 'SaldosPage', isLanc: 'LancamentosPage', isProg: 'ProgramacaoPage', isFluxo: 'FluxoPage', isDashboard: 'DashboardPage' }[m[1]];
    }
  }
  if (node.nodeName === 'aside') return 'Sidebar';
  if (node.nodeName === 'header') return 'Header';
  const st = getAttr(node, 'style') || '';
  const M = { '{{ overlayStyle }}': 'UserModal', '{{ deptOverlayStyle }}': 'DeptModal', '{{ perfilOverlayStyle }}': 'PerfilModal', '{{ iaOverlayStyle }}': 'IaPanel', '{{ toastStyle }}': 'Toast' };
  if (M[st.trim()]) return M[st.trim()];
  return null;
}

function emit(node, scope, ind) {
  const name = scope.length === 0 ? extractName(node) : null;
  if (name && !node.__extracting) {
    node.__extracting = true;
    const inner = emit(node, scope, '    ');
    components.push({ name, jsx: inner });
    return `${ind}<${name} v={v} />`;
  }
  const tag = node.nodeName === 'svg' || node.namespaceURI?.includes('svg') ? node.tagName : node.nodeName;
  if (tag === 'sc-if') {
    const cond = expr((getAttr(node, 'value') || '').replace(/[{}]/g, ''), scope);
    const body = emitChildren(node, scope, ind + '    ');
    return `${ind}{${cond} ? (\n${ind}  <>\n${body}\n${ind}  </>\n${ind}) : null}`;
  }
  if (tag === 'sc-for') {
    const list = expr((getAttr(node, 'list') || '').replace(/[{}]/g, ''), scope);
    const as = getAttr(node, 'as') || 'item';
    const idx = `_i${scope.length}`;
    const body = emitChildren(node, [...scope, as], ind + '    ');
    return `${ind}{(${list} || []).map((${as}: any, ${idx}: number) => (\n${ind}  <Fragment key={${idx}}>\n${body}\n${ind}  </Fragment>\n${ind}))}`;
  }
  const attrs = emitAttrs(node, scope);
  if (VOID.has(tag)) return `${ind}<${tag}${attrs} />`;
  const kids = emitChildren(node, scope, ind + '  ');
  if (!kids.trim()) return `${ind}<${tag}${attrs}></${tag}>`;
  return `${ind}<${tag}${attrs}>\n${kids}\n${ind}</${tag}>`;
}

// Root: everything inside <x-dc> becomes <AppRoot>.
const rootKids = frag.childNodes.filter(c => c.nodeName !== '#comment' && !(c.nodeName === '#text' && !c.value.trim()));
const rootJsx = rootKids.map(c => emit(c, [], '      ')).join('\n');
components.push({ name: 'AppRoot', jsx: rootJsx });

mkdirSync(OUT, { recursive: true });
const names = components.map(c => c.name);
for (const c of components) {
  const used = names.filter(n => n !== c.name && new RegExp(`<${n} v=\\{v\\} />`).test(c.jsx));
  const imports = used.map(n => `import ${n} from './${n}';`).join('\n');
  const src = `// GENERATED by scripts/convert-template.mjs from project/SaaS Home.dc.html — do not edit.
/* eslint-disable */
import { Fragment } from 'react';
import { css, hv } from '../../dc/runtime';
${imports}

export default function ${c.name}({ v }: { v: any }) {
  void Fragment; void css; void hv;
  return (
    <>
${c.jsx}
    </>
  );
}
`;
  writeFileSync(join(OUT, c.name + '.tsx'), src);
}
console.log('Generated:', names.join(', '));
