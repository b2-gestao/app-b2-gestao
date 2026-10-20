// Tema claro/escuro: escolha salva no navegador, aplicada em <html data-theme>. Padrão: claro.
export type Tema = 'light' | 'dark';

const KEY = 'b2-tema';
const COR_BARRA: Record<Tema, string> = { light: '#4161FF', dark: '#0F1115' };

export function getTema(): Tema {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function aplicarTema(t: Tema, salvar = true) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[t]);
  if (!salvar) return;
  try { localStorage.setItem(KEY, t); } catch { /* armazenamento indisponível: vale só na sessão */ }
}

export function alternarTema(): Tema {
  const novo: Tema = getTema() === 'dark' ? 'light' : 'dark';
  aplicarTema(novo);
  return novo;
}

export function iniciarTema() {
  let salvo: string | null = null;
  try { salvo = localStorage.getItem(KEY); } catch { /* ignora */ }
  aplicarTema(salvo === 'dark' ? 'dark' : 'light', false);
}
