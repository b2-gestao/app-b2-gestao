// Notas Fiscais: tokens visuais compartilhados pelas telas Cadastros e Título a Pagar.

export const colHead = { fontSize: '10.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 } as const;
export const card = 'border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03),0 4px 16px rgba(0,0,0,.025)';
export const anim = (ms: number) => `opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:${ms}ms`;
export const input = 'height:38px;width:100%;padding:0 12px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;font-size:13px;font-family:inherit;color:#111827;transition:border-color .15s,box-shadow .15s';
export const btnPrim = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border:none;border-radius:9px;background:#4161FF;color:#FFFFFF;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(65,97,255,.26);transition:background .15s,transform .15s,box-shadow .15s';
export const btnPrimHover = 'background:#3153F4;box-shadow:0 8px 20px rgba(65,97,255,.34)';
export const btnSec = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 12px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#374151;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,transform .15s';
export const btnSecHover = 'background:#F4F4F6;border-color:#D8D8E0';
export const off = ';opacity:.5;cursor:default;box-shadow:none';
export const link = 'border:none;background:none;padding:0;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer';

export const TONS = {
  erro: { bg: '#FEE9E9', bd: '#FCA5A5', fg: '#B91C1C', dot: '#EF4444' },
  aviso: { bg: '#FFF7E8', bd: '#FAD59A', fg: '#92590A', dot: '#F59E0B' },
  info: { bg: '#F2F5FF', bd: '#D5DEFF', fg: '#3148B8', dot: '#4161FF' },
  ok: { bg: '#E9F8F2', bd: '#BDE8D8', fg: '#1F7A5C', dot: '#43B997' },
} as const;
