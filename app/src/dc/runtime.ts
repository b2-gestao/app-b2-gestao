import type { CSSProperties } from 'react';

// Runtime helpers for the generated screens. The prototype expresses styles as CSS
// strings (often computed), plus style-hover / style-active / style-focus attributes.

const styleCache = new Map<string, CSSProperties>();

function splitDecls(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

function propName(p: string): string {
  if (p.startsWith('--')) return p;
  const c = p.replace(/-([a-z])/g, (_, x: string) => x.toUpperCase());
  return p.startsWith('-webkit-') ? 'Webkit' + c.slice(7) : c;
}

/** Parses a CSS declaration string into a React style object (memoized). */
export function css(text: string | null | undefined): CSSProperties | undefined {
  if (!text) return undefined;
  let hit = styleCache.get(text);
  if (hit) return hit;
  const obj: Record<string, string> = {};
  for (const d of splitDecls(text)) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    obj[propName(d.slice(0, i).trim())] = d.slice(i + 1).trim();
  }
  hit = obj as CSSProperties;
  if (styleCache.size > 5000) styleCache.clear();
  styleCache.set(text, hit);
  return hit;
}

// Pseudo-state styles are compiled into generated class rules. They are marked
// !important so they win over the element's inline style, like the prototype.
const classCache = new Map<string, string>();
let sheet: CSSStyleSheet | null = null;
let seq = 0;

function important(text: string): string {
  return splitDecls(text)
    .map(d => (d.includes('!important') ? d : d + ' !important'))
    .join(';');
}

function getSheet(): CSSStyleSheet | null {
  if (sheet) return sheet;
  if (typeof document === 'undefined') return null;
  const el = document.createElement('style');
  el.setAttribute('data-dc-states', '');
  document.head.appendChild(el);
  sheet = el.sheet;
  return sheet;
}

export function hv(hover?: string | null, active?: string | null, focus?: string | null): string | undefined {
  if (!hover && !active && !focus) return undefined;
  const key = `${hover ?? ''}|${active ?? ''}|${focus ?? ''}`;
  const hit = classCache.get(key);
  if (hit) return hit;
  const cls = `dcs${(seq++).toString(36)}`;
  const s = getSheet();
  if (s) {
    const add = (rule: string) => {
      try {
        s.insertRule(rule, s.cssRules.length);
      } catch {
        /* ignore rules the browser rejects */
      }
    };
    if (hover) add(`.${cls}:hover{${important(hover)}}`);
    if (active) add(`.${cls}:active{${important(active)}}`);
    if (focus) add(`.${cls}:focus{${important(focus)}}`);
  }
  classCache.set(key, cls);
  return cls;
}
