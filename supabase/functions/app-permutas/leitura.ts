// Texto do corpo do contrato, para a OpenAI ler só o que interessa (e mais barato que mandar o PDF inteiro).
// Os contratos do Docusign trazem "Página X de N" no rodapé: N é o tamanho do corpo; o que vem depois (memorial
// descritivo, plantas, certificado de conclusão) fica de fora. Lê página a página e para no fim do corpo, para
// caber no limite de CPU da edge function. PDF sem texto (escaneado) devolve null e vai como arquivo.

import { getDocumentProxy } from "npm:unpdf@0.12.1";

/** Abaixo disso, na primeira página, o PDF é tratado como escaneado. */
const MIN_CARACTERES_PAGINA = 200;
/** Teto do texto enviado (~50 mil tokens). */
const MAX_CARACTERES = 200_000;

export interface TextoContrato { texto: string; paginasLidas: number; totalPaginas: number }

export async function textoDoContrato(pdf: Uint8Array): Promise<TextoContrato | null> {
  let doc;
  try {
    doc = await getDocumentProxy(pdf);
  } catch (e) {
    console.error("app-permutas: PDF ilegível para texto", e instanceof Error ? e.message : e);
    return null;
  }
  const total = doc.numPages;
  let fim = total;
  const paginas: string[] = [];
  let tamanho = 0;
  for (let i = 1; i <= fim; i++) {
    const conteudo = await (await doc.getPage(i)).getTextContent();
    const texto = conteudo.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/[ \t]+/g, " ").trim();
    if (i === 1 && texto.replace(/\s/g, "").length < MIN_CARACTERES_PAGINA) return null;
    // O rodapé das primeiras páginas diz quantas páginas o corpo tem.
    const rodape = i <= 3 ? texto.match(/P[áa]gina\s+\d+\s+de\s+(\d+)/i) : null;
    if (rodape) fim = Math.min(total, Math.max(i, Number(rodape[1])));
    paginas.push(`--- Página ${i} ---\n${texto}`);
    tamanho += texto.length;
    if (tamanho > MAX_CARACTERES) break;
  }
  return { texto: paginas.join("\n\n").slice(0, MAX_CARACTERES), paginasLidas: paginas.length, totalPaginas: total };
}
