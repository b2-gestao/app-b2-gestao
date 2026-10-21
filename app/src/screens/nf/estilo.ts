// Notas Fiscais: tokens visuais compartilhados pelas telas Cadastros e Título a Pagar.

export const colHead = { fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-4)', fontWeight: 600 } as const;
export const card = 'border-radius:10px;background:var(--surface);box-shadow:0 0 0 1px var(--border-soft),0 1px 2px rgba(0,0,0,.03),0 4px 16px rgba(0,0,0,.025)';
export const anim = (ms: number) => `opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:${ms}ms`;
export const input = 'height:38px;width:100%;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:13px;font-family:inherit;color:var(--text);transition:border-color .15s,box-shadow .15s';
export const btnPrim = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border:none;border-radius:9px;background:#4161FF;color:#FFFFFF;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(65,97,255,.26);transition:background .15s,transform .15s,box-shadow .15s';
export const btnPrimHover = 'background:#3153F4;box-shadow:0 8px 20px rgba(65,97,255,.34)';
export const btnSec = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text-b);font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,transform .15s';
export const btnSecHover = 'background:var(--surface-3);border-color:var(--border-strong)';
export const off = ';opacity:.5;cursor:default;box-shadow:none';
export const link = 'border:none;background:none;padding:0;color:var(--accent-text);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer';

export const TONS = {
  erro: { bg: 'var(--tint-red)', bd: 'var(--danger-border)', fg: 'var(--tx-b91c1c)', dot: '#EF4444' },
  aviso: { bg: 'var(--tint-amber-2)', bd: '#FAD59A', fg: 'var(--tx-92590a)', dot: '#F59E0B' },
  info: { bg: 'var(--tint-blue-2)', bd: 'var(--bd-d5deff)', fg: 'var(--tx-3148b8)', dot: '#4161FF' },
  ok: { bg: 'var(--tint-green-2)', bd: 'var(--bd-bde8d8)', fg: 'var(--tx-1f7a5c)', dot: '#43B997' },
} as const;
