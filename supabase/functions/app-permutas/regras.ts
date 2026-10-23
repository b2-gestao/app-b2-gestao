// Sugestão de preenchimento da modal do permutante a partir do contrato lido (extracao.ts) e as conferências feitas
// sem IA: CPF/CNPJ, matrícula × coeficiente × % contra a área do contrato e unidades contra a área devida.
// A tela ainda confere a empresa (CNPJ na tabela de empresas), localiza as unidades no catálogo do Sienge e busca
// o valor de cada uma na tabela de vendas do mês do contrato.

import type { ContratoExtraido } from "./extracao.ts";

const fmt2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const m2 = (v: number) => `${fmt2.format(v)} m²`;
const brl = (v: number) => `R$ ${fmt2.format(v)}`;
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
const digitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const texto = (s: string | null | undefined) => (s || "").trim().replace(/\s+/g, " ") || null;

function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

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

export const cpfCnpjValido = (d: string) => (d.length === 11 ? cpfValido(d) : cnpjValido(d));
const fmtDoc = (d: string) => (d.length === 11
  ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
  : d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"));

export type Aviso = { nivel: "ok" | "atencao" | "info"; texto: string };

export interface UnidadeContrato { empreendimento: string; cnpj: string | null; unidade: string; area_m2: number | null; extras: string | null }

export interface Sugestao {
  permutante: string | null;
  cpf_cnpj: string | null;
  num_matricula: string | null;
  area_matricula: number | null;
  coeficiente: number | null;
  /** Em pontos percentuais (12 = 12%), como a tela digita. */
  pct_permuta: number | null;
  area_propria: number | null;
  area_informada: number | null;
  data_contrato: string | null;
  cidade: string | null;
  inscricao_iptu: string | null;
  inscricao_equatorial: string | null;
  inscricao_saneago: string | null;
  observacao: string | null;
  empresa: { cnpj: string | null; nome: string | null };
  matriculas: string[];
  unidades: UnidadeContrato[];
}

export function montarSugestao(d: ContratoExtraido): { sugestao: Sugestao; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const imoveis = d.imoveis.filter((i) => i.matricula.trim());
  const matriculas = imoveis.map((i) => i.matricula.trim());

  if (d.tipoDocumento === "OUTRO") avisos.push({ nivel: "atencao", texto: "O documento não parece um contrato de permuta de terreno. Confira os dados antes de salvar." });
  if (d.tipoDocumento === "ESCRITURA_PERMUTA") avisos.push({ nivel: "info", texto: "Lida uma escritura pública. O PDF entra nos documentos como Escritura." });

  const nome = texto(d.permutante.nome);
  if (!nome) avisos.push({ nivel: "atencao", texto: "Não foi possível identificar o permutante principal." });
  let doc = digitos(d.permutante.cpfCnpj) || null;
  if (doc && !cpfCnpjValido(doc)) {
    avisos.push({ nivel: "atencao", texto: `O CPF/CNPJ lido do permutante (${doc}) é inválido e ficou em branco. Confira no contrato.` });
    doc = null;
  }
  if (!matriculas.length) avisos.push({ nivel: "atencao", texto: "Nenhuma matrícula encontrada no contrato." });

  // Área da matrícula: soma dos terrenos do permutante.
  const areaMatricula = imoveis.length && imoveis.every((i) => positivo(i.areaM2)) ? r4(imoveis.reduce((s, i) => s + (i.areaM2 as number), 0)) : null;
  if (areaMatricula == null && matriculas.length) avisos.push({ nivel: "atencao", texto: "Área do terreno não encontrada na descrição do imóvel." });

  const coef = positivo(d.coeficiente) ? d.coeficiente : null;
  const pct = positivo(d.percentualPermuta) && d.percentualPermuta <= 100 ? d.percentualPermuta : null;
  const areaContrato = positivo(d.areaPermutaM2) ? d.areaPermutaM2 : null;
  let areaInformada: number | null = null;
  let areaPermuta: number | null;
  if (coef != null && pct != null) {
    // Contrato por percentual: a tela calcula matrícula × coeficiente × %.
    areaPermuta = areaMatricula != null ? areaMatricula * coef * (pct / 100) : null;
    if (areaPermuta != null && areaContrato != null) {
      avisos.push(Math.abs(areaPermuta - areaContrato) <= 0.05
        ? { nivel: "ok", texto: `Cálculo conferido: ${m2(areaMatricula!)} × ${pctFmt.format(coef)} × ${pctFmt.format(pct)}% = ${m2(areaPermuta)}, igual ao contrato.` }
        : { nivel: "atencao", texto: `Matrícula × coeficiente × % dá ${m2(areaPermuta)}, mas o contrato fala em ${m2(areaContrato)}. Confira os números.` });
    }
  } else {
    // Sem % e coeficiente: a área de permuta informada é a própria área da matrícula (regra do cadastro).
    areaInformada = areaMatricula;
    areaPermuta = areaMatricula;
    if (areaMatricula != null) {
      avisos.push({ nivel: "info", texto: `Contrato sem % e coeficiente: ${m2(areaMatricula)} em área de matrícula e em área de permuta informada.` });
    }
  }

  let areaPropria: number | null = null;
  if (d.pagamento === "PROPRIO" && areaPermuta != null) areaPropria = r4(areaPermuta);
  else if (d.pagamento === "DIVERSOS") areaPropria = 0;
  else if (d.pagamento === "MISTO") avisos.push({ nivel: "info", texto: "Pagamento em parte no próprio empreendimento e em parte em outros: informe a área própria." });

  const unidades: UnidadeContrato[] = d.unidades
    .filter((u) => u.unidade.trim())
    .map((u) => ({
      empreendimento: u.empreendimento.trim(),
      cnpj: digitos(u.cnpjProprietaria) || null,
      unidade: u.unidade.trim(),
      area_m2: positivo(u.areaM2) ? u.areaM2 : null,
      extras: texto(u.extras),
    }));
  const somaUnidades = unidades.length && unidades.every((u) => u.area_m2 != null) ? r4(unidades.reduce((s, u) => s + (u.area_m2 as number), 0)) : null;
  // Unidades × área permutada (sem % e coeficiente, o próprio terreno; com %, a área de permuta calculada).
  const base = coef != null && pct != null ? "à área de permuta" : "ao terreno permutado";
  let diferenca: string | null = null;
  if (somaUnidades != null && areaPermuta != null && Math.abs(somaUnidades - areaPermuta) > 0.01) {
    const sentido = somaUnidades > areaPermuta ? "superior" : "inferior";
    diferenca = `Área das unidades vinculadas (${m2(somaUnidades)}) ${sentido} ${base} (${m2(areaPermuta)}) em ${m2(Math.abs(somaUnidades - areaPermuta))}.`;
    avisos.push({ nivel: "atencao", texto: `${diferenca} Registrado na observação.` });
  }

  const empresaCnpj = digitos(d.segundaPermutante.cnpj) || null;

  // Observação: o que o contrato traz e o cadastro não tem campo para guardar.
  const linhas: string[] = ["Importado do contrato por IA."];
  const tipo = d.tipoDocumento === "ESCRITURA_PERMUTA" ? "Escritura pública de permuta" : "Compromisso particular de permuta";
  const data = d.tipoDocumento === "ESCRITURA_PERMUTA" ? d.dataEscritura || d.dataContrato : d.dataContrato;
  linhas.push(`${tipo}${data ? ` de ${dataBr(data)}` : ""}${d.registroEscritura ? ` · ${d.registroEscritura.trim()}` : ""}.`);
  if (d.segundaPermutante.nome) linhas.push(`Segunda Permutante: ${d.segundaPermutante.nome.trim()}${empresaCnpj ? ` (CNPJ ${fmtDoc(empresaCnpj)})` : ""}.`);
  imoveis.forEach((i) => linhas.push(`Terreno: matr. ${i.matricula}${positivo(i.areaM2) ? ` – ${m2(i.areaM2)}` : ""}${i.descricao ? ` – ${i.descricao.trim()}` : ""}.`));
  if (areaContrato != null) {
    const porEmp = new Map<string, number>();
    unidades.forEach((u) => porEmp.set(u.empreendimento, (porEmp.get(u.empreendimento) || 0) + (u.area_m2 || 0)));
    const emps = [...porEmp].filter(([, a]) => a > 0);
    const onde = emps.length === 1 ? ` no ${emps[0][0]}` : emps.length ? `: ${emps.map(([e, a]) => `${m2(a)} no ${e}`).join(" e ")}` : "";
    linhas.push(`Pagamento: ${m2(areaContrato)}${pct != null ? ` (${pctFmt.format(pct)}% de área privativa)` : ""}${onde}.`);
  }
  const extras = unidades.filter((u) => u.extras).map((u) => `${u.unidade} – ${u.extras}`);
  if (extras.length) linhas.push(`Vagas e extras: ${extras.join("; ")}.`);
  if (diferenca) linhas.push(diferenca);
  if (d.excedente && (positivo(d.excedente.areaM2) || positivo(d.excedente.valor))) {
    const e = d.excedente;
    linhas.push(`Excedente pago pelo permutante: ${[positivo(e.areaM2) ? m2(e.areaM2) : "", positivo(e.valor) ? brl(e.valor) : ""].filter(Boolean).join(", ")}${e.condicoes ? ` – ${e.condicoes.trim()}` : ""}.`);
  }
  const clausula = texto(d.clausulaDiferenca);
  if (clausula) linhas.push(`Cláusula da diferença: ${clausula.replace(/\.$/, "")}.`);

  return {
    sugestao: {
      permutante: nome ? nome.slice(0, 300) : null,
      cpf_cnpj: doc,
      num_matricula: matriculas.length ? matriculas.join(" / ").slice(0, 200) : null,
      area_matricula: areaMatricula,
      coeficiente: coef,
      pct_permuta: pct,
      area_propria: areaPropria,
      area_informada: areaInformada,
      data_contrato: d.dataContrato || d.dataEscritura || null,
      cidade: texto(d.cidade),
      inscricao_iptu: texto(d.inscricaoIptu),
      inscricao_equatorial: texto(d.ucEquatorial),
      inscricao_saneago: texto(d.ucSaneago),
      observacao: linhas.join("\n").slice(0, 4000),
      empresa: { cnpj: empresaCnpj, nome: texto(d.segundaPermutante.nome) },
      matriculas,
      unidades,
    },
    avisos,
  };
}
