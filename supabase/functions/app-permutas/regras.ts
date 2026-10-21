// Sugestão de preenchimento da modal "Novo permutante" a partir da escritura lida (extracao.ts) e as
// conferências feitas sem IA: soma das matrículas, matrícula × coeficiente × % contra a área declarada e CNPJ.

import type { EscrituraExtraida } from "./extracao.ts";

const fmt2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m2 = (v: number) => `${fmt2.format(v)} m²`;
const brl = (v: number) => `R$ ${fmt2.format(v)}`;
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

export function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    let soma = 0, peso = base.length - 7;
    for (const c of base) { soma += Number(c) * peso--; if (peso < 2) peso = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

const fmtCnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const juntarNomes = (n: string[]) => (n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`);

export type Aviso = { nivel: "ok" | "atencao" | "info"; texto: string };

export interface Sugestao {
  permutante: string | null;
  num_matricula: string | null;
  area_matricula: number | null;
  coeficiente: number | null;
  /** Em pontos percentuais (12 = 12%), como a tela digita. */
  pct_permuta: number | null;
  area_propria: number | null;
  area_informada: number | null;
  data_contrato: string | null;
  observacao: string | null;
  pendencia: string | null;
  empresa: { cnpj: string | null; nome: string | null };
  matriculas: string[];
}

export function montarSugestao(d: EscrituraExtraida): { sugestao: Sugestao; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const nomes = d.permutantes.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean);
  const imoveis = d.imoveis.filter((i) => i.matricula.trim());
  const matriculas = imoveis.map((i) => i.matricula.trim());

  if (d.tipoDocumento === "OUTRO") avisos.push({ nivel: "atencao", texto: "O documento não parece um contrato de permuta de terreno. Confira os dados antes de salvar." });
  if (d.tipoDocumento === "COMPROMISSO_PERMUTA") avisos.push({ nivel: "info", texto: "É um compromisso particular de permuta, não a escritura pública. O anexo foi marcado como Contrato." });
  if (!nomes.length) avisos.push({ nivel: "atencao", texto: "Não foi possível identificar os permutantes (donos do terreno)." });
  if (nomes.length > 1) avisos.push({ nivel: "info", texto: `${nomes.length} permutantes no mesmo cadastro (${juntarNomes(nomes)}).` });
  if (!matriculas.length) avisos.push({ nivel: "atencao", texto: "Nenhuma matrícula encontrada no documento." });

  // Área da matrícula: soma dos terrenos; sem todas as áreas, vale a área total declarada.
  const todasAreas = imoveis.length > 0 && imoveis.every((i) => positivo(i.areaM2));
  const soma = todasAreas ? r4(imoveis.reduce((s, i) => s + (i.areaM2 as number), 0)) : null;
  const areaMatricula = soma ?? (positivo(d.areaTotalM2) ? d.areaTotalM2 : null);
  if (soma != null && positivo(d.areaTotalM2) && Math.abs(soma - d.areaTotalM2) > 0.01) {
    avisos.push({ nivel: "atencao", texto: `A soma das matrículas (${m2(soma)}) difere da área total declarada (${m2(d.areaTotalM2)}). Usada a soma.` });
  }
  if (imoveis.length > 1 && soma != null) {
    avisos.push({ nivel: "info", texto: `${imoveis.length} matrículas somadas: ${imoveis.map((i) => `${i.matricula} (${m2(i.areaM2 as number)})`).join(" + ")} = ${m2(soma)}.` });
  }

  const coef = positivo(d.coeficiente) ? d.coeficiente : null;
  const pct = positivo(d.percentualPermuta) && d.percentualPermuta <= 100 ? d.percentualPermuta : null;
  if (coef == null) avisos.push({ nivel: "atencao", texto: "Coeficiente de aproveitamento não encontrado." });
  if (pct == null) avisos.push({ nivel: "atencao", texto: "% de permuta não encontrado." });

  const calculada = areaMatricula != null && coef != null && pct != null ? areaMatricula * coef * (pct / 100) : null;
  const declarada = positivo(d.areaPermutaM2) ? d.areaPermutaM2 : null;
  if (calculada != null && declarada != null) {
    if (Math.abs(calculada - declarada) <= 0.05) {
      avisos.push({ nivel: "ok", texto: `Cálculo conferido: ${m2(areaMatricula!)} × ${fmt2.format(coef!)} × ${fmt2.format(pct!)}% = ${m2(calculada)}, igual ao declarado na escritura.` });
    } else {
      avisos.push({ nivel: "atencao", texto: `Matrícula × coeficiente × % dá ${m2(calculada)}, mas a escritura declara ${m2(declarada)}. Confira os números.` });
    }
  }
  const areaPermuta = calculada ?? declarada;
  // Sem matrícula, coeficiente ou %, a área declarada entra como "informada" (regra do cadastro).
  const areaInformada = calculada == null && declarada != null ? declarada : null;

  let areaPropria: number | null = null;
  if (d.pagamento === "PROPRIO" && areaPermuta != null) areaPropria = r4(areaPermuta);
  else if (d.pagamento === "MISTO") avisos.push({ nivel: "info", texto: "Pagamento em parte no próprio empreendimento e em parte em outros: informe a área própria." });
  else if (d.pagamento == null) avisos.push({ nivel: "info", texto: "Não ficou claro onde as unidades são entregues; a área no próprio empreendimento ficou em branco." });

  const cnpj = (d.adquirenteCnpj || "").replace(/\D/g, "") || null;
  if (cnpj && !cnpjValido(cnpj)) avisos.push({ nivel: "atencao", texto: `O CNPJ lido da Segunda Permutante (${fmtCnpj(cnpj)}) é inválido. Selecione a empresa manualmente.` });

  const linhas: string[] = ["Importado da escritura por IA — revisar."];
  const ato = [d.cartorio, d.registroCartorio, d.dataEscritura ? `lavrada em ${dataBr(d.dataEscritura)}` : ""].filter(Boolean).join(" · ");
  if (ato) linhas.push(`${d.tipoDocumento === "COMPROMISSO_PERMUTA" ? "Compromisso" : "Escritura"}: ${ato}.`);
  if (d.dataCompromisso && d.dataCompromisso !== d.dataEscritura) linhas.push(`Compromisso particular de ${dataBr(d.dataCompromisso)}.`);
  if (d.adquirenteNome) linhas.push(`Segunda Permutante: ${d.adquirenteNome}${cnpj ? ` (CNPJ ${fmtCnpj(cnpj)})` : ""}.`);
  if (imoveis.length) {
    linhas.push("Imóveis:");
    imoveis.forEach((i) => linhas.push(`- Matr. ${i.matricula}${positivo(i.areaM2) ? ` – ${m2(i.areaM2)}` : ""}${i.descricao ? ` – ${i.descricao}` : ""}`));
  }
  const valores = [
    positivo(d.valorFiscal) ? `Valor fiscal dos imóveis: ${brl(d.valorFiscal)}` : "",
    positivo(d.precoM2Tabela) ? `Preço de tabela previsto: ${brl(d.precoM2Tabela)}/m²` : "",
    declarada != null ? `Área mínima declarada: ${m2(declarada)}` : "",
  ].filter(Boolean);
  if (valores.length) linhas.push(valores.join(" · ") + ".");
  if (d.prazos.length) { linhas.push("Prazos:"); d.prazos.forEach((p) => linhas.push(`- ${p.trim()}`)); }
  if (d.outrosPontos.length) { linhas.push("Outros pontos:"); d.outrosPontos.slice(0, 6).forEach((p) => linhas.push(`- ${p.trim()}`)); }

  const pend = d.condicoesPendentes.map((c) => c.trim().replace(/\.$/, "")).filter(Boolean).join("; ");

  return {
    sugestao: {
      permutante: nomes.length ? juntarNomes(nomes).slice(0, 300) : null,
      num_matricula: matriculas.length ? matriculas.join(" / ").slice(0, 200) : null,
      area_matricula: areaMatricula,
      coeficiente: coef,
      pct_permuta: pct,
      area_propria: areaPropria,
      area_informada: areaInformada,
      data_contrato: d.dataEscritura || d.dataCompromisso || null,
      observacao: linhas.join("\n").slice(0, 4000),
      pendencia: pend ? (pend.length > 300 ? pend.slice(0, 297) + "…" : pend) : null,
      empresa: { cnpj, nome: d.adquirenteNome?.trim() || null },
      matriculas,
    },
    avisos,
  };
}
