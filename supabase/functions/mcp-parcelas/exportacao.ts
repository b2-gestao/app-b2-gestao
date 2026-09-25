// Exportação para arquivo: os dados vão do banco para o Storage e o usuário baixa por link.
// Nada passa pela conversa, então não consome tokens.
//   até LIMITE_SINCRONO linhas -> Excel (.xlsx) gerado na hora
//   acima                      -> CSV compactado (.csv.gz) em partes, em segundo plano
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { consulta, SEGREDO_INTERNO } from "./db.ts";
import { type Coluna, resolverColunas } from "./colunas.ts";
import { COLUNAS_PAGAR, PADRAO_PAGAR } from "./colunas_pagar.ts";
import { type Filtros, keyset, montarFiltro, ORDEM_RECEBER } from "./filtros.ts";
import { type FiltrosPagar, montarFiltroPagar, ORDEM_PAGAR } from "./filtros_pagar.ts";
import type { Contexto } from "./ferramentas.ts";

export type Fonte = "receber" | "pagar";

// Vai junto de toda exportação: o arquivo traz as baixas de Abatimento de Adiantamento,
// mas elas não entram nos totais (o adiantamento já foi recebido/pago antes).
const AVISO_COMPENSACAO: Record<Fonte, string> = {
  receber: "Avise o usuário que o arquivo também traz as baixas do tipo 'Abatimento de Adiantamento' (categoria Compensação) " +
    "e que elas NÃO entram no cálculo do contas a receber/recebido, porque o adiantamento já foi recebido antes.",
  pagar: "Avise o usuário que o arquivo também traz as baixas do tipo 'Abatimento de Adiantamento' (categoria Compensação) " +
    "e que elas NÃO entram no cálculo do contas a pagar/pago, porque o adiantamento já foi pago antes.",
};

const LIMITE_SINCRONO = 50_000;
const LINHAS_POR_PARTE = 200_000; // tabela inteira (~1,37 mi) = 7 arquivos
const LINHAS_POR_LOTE = 10_000;
const VALIDADE_LINK_S = 3600;
const BUCKET = "mcp-exports";
const SENSIVEIS = ["client_name", "client_id", "document_number"];

const storage = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  }).storage.from(BUCKET);

interface Pedido { fonte?: Fonte; filtros: Filtros | FiltrosPagar; colunas?: string | string[] }

// Exportação sempre com listagem=true: traz as linhas de Abatimento de Adiantamento junto.
function preparar(p: Pedido, perfil: Contexto["perfil"]) {
  if (p.fonte === "pagar") {
    const fm = montarFiltroPagar(p.filtros as FiltrosPagar, { listagem: true });
    const { colunas } = resolverColunas(fm.linha, p.colunas ?? "completo", COLUNAS_PAGAR, PADRAO_PAGAR);
    return { fm, colunas, ordem: ORDEM_PAGAR[fm.linha] };
  }
  const fm = montarFiltro(p.filtros as Filtros, { listagem: true });
  let { colunas } = resolverColunas(fm.linha, p.colunas ?? "completo");
  if (perfil === "externo") colunas = colunas.filter((c) => !SENSIVEIS.includes(c.id));
  return { fm, colunas, ordem: ORDEM_RECEBER[fm.linha] };
}

/** Busca um lote de linhas cruas (valores sem formatação) por keyset. */
async function lote(p: Pedido, perfil: Contexto["perfil"], depois: string[] | null, n: number) {
  const { fm, colunas, ordem } = preparar(p, perfil);
  const params = [...fm.params];
  const conds = [...fm.where];
  const ks = keyset(ordem, params, depois);
  if (ks.cond) conds.push(ks.cond);
  const linhas = await consulta(
    `select ${colunas.map((c) => `${c.expr[fm.linha]} as "${c.id}"`).join(", ")}, ${ks.select}
     from ${fm.from} ${conds.length ? "where " + conds.join(" and ") : ""}
     order by ${ks.orderBy} limit ${n}`, params);
  const ult = linhas[linhas.length - 1];
  return { linhas, colunas, proximo: ult ? ks.extrair(ult) : null };
}

// Valor de célula: datas em dd/mm/aaaa, JSON como texto.
function celula(c: Coluna, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (c.tipo === "data") {
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    const [a, m, d] = s.split("-");
    return `${d}/${m}/${a}`;
  }
  if (c.tipo === "json") return typeof v === "string" ? v : JSON.stringify(v);
  if (c.tipo === "moeda" || c.tipo === "numero") return Number(v);
  return v;
}

// CSV no padrão do Excel brasileiro: separador ';' e vírgula decimal.
function csvCampo(c: Coluna, v: unknown): string {
  const x = celula(c, v);
  if (x === null) return "";
  if (typeof x === "number") return c.tipo === "moeda" ? x.toFixed(2).replace(".", ",") : String(x);
  const s = String(x);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function link(caminho: string) {
  const { data, error } = await storage().createSignedUrl(caminho, VALIDADE_LINK_S, { download: true });
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------- ferramenta exportar_receber

export async function exportar(args: Record<string, unknown>, ctx: Contexto, fonte: Fonte = "receber") {
  const { colunas: pedidoColunas, ...filtros } = args as Filtros & { colunas?: string | string[] };
  const pedido: Pedido = { fonte, filtros, colunas: pedidoColunas };
  const nomeArquivo = fonte === "pagar" ? "contas-a-pagar" : "contas-a-receber";
  const { fm } = preparar(pedido, ctx.perfil);
  const [{ total }] = await consulta<{ total: string }>(
    `select count(*) as total from ${fm.from} ${fm.where.length ? "where " + fm.where.join(" and ") : ""}`, fm.params);
  const n = Number(total);
  if (n === 0) return { status: "vazio", filtros_aplicados: fm.aplicados, orientacao_ao_claude: "Nenhuma linha com esses filtros." };

  const id = crypto.randomUUID();

  if (n <= LIMITE_SINCRONO) {
    const { linhas, colunas } = await lote(pedido, ctx.perfil, null, n);
    const planilha = linhas.map((l) => Object.fromEntries(colunas.map((c) => [c.nome, celula(c, l[c.id])])));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planilha), "Parcelas");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
    const caminho = `${id}/${nomeArquivo}.xlsx`;
    const { error } = await storage().upload(caminho, new Uint8Array(bytes), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (error) throw error;
    await consulta(
      `insert into mcp.exportacoes (id, client_id, pedido, status, total_linhas, linhas_processadas, partes, concluido_em)
       values ($1, $2, $3, 'concluido', $4, $4, $5, now())`,
      [id, ctx.clientId, JSON.stringify(pedido), n, JSON.stringify([caminho])]);
    return {
      status: "pronto",
      formato: "Excel (.xlsx)",
      total_linhas: n,
      link_download: await link(caminho),
      validade_link: "1 hora",
      filtros_aplicados: fm.aplicados,
      orientacao_ao_claude: "Entregue o link ao usuário, diga quantas linhas tem, a validade de 1 hora e os filtros aplicados. " +
        AVISO_COMPENSACAO[fonte],
    };
  }

  const partes = Math.ceil(n / LINHAS_POR_PARTE);
  await consulta(
    `insert into mcp.exportacoes (id, client_id, pedido, status, total_linhas, linhas_processadas, partes)
     values ($1, $2, $3, 'processando', $4, 0, '[]'::jsonb)`,
    [id, ctx.clientId, JSON.stringify(pedido), n]);
  dispararProcessamento(id);
  return {
    status: "em_processamento",
    codigo_exportacao: id,
    formato: `CSV compactado (.csv.gz), separador ';'${partes > 1 ? `, dividido em ${partes} arquivos de até ${LINHAS_POR_PARTE.toLocaleString("pt-BR")} linhas` : ""}`,
    total_linhas: n,
    tempo_estimado: `${Math.max(1, Math.ceil(n / 60_000))} a ${Math.max(2, Math.ceil(n / 30_000))} minutos`,
    filtros_aplicados: fm.aplicados,
    orientacao_ao_claude:
      "Explique que o volume é grande demais para exibir na conversa (limite de contexto do Claude) e por isso está sendo gerado um arquivo. " +
      "Informe o código, o tempo estimado e que o usuário pode perguntar 'ficou pronto?' — aí chame status_exportacao. " +
      AVISO_COMPENSACAO[fonte],
  };
}

// ---------------------------------------------------------------- processamento em segundo plano

function dispararProcessamento(id: string) {
  const base = Deno.env.get("SUPABASE_URL")!;
  const req = fetch(`${base}/functions/v1/mcp-parcelas/interno/exportar`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mcp-interno": SEGREDO_INTERNO },
    body: JSON.stringify({ id }),
  }).catch((e) => console.error("falha ao disparar exportação", e));
  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(req);
}

/** Gera UMA parte do CSV e, se faltar, dispara a próxima (cada parte roda numa execução nova da função). */
export async function processarParte(id: string) {
  const [job] = await consulta<{
    pedido: Pedido; client_id: string; cursor: string[] | null; partes: string[]; linhas_processadas: number; perfil: string;
  }>(
    `select e.pedido, e.client_id, e.cursor, e.partes, e.linhas_processadas, c.perfil
     from mcp.exportacoes e join mcp.credenciais c on c.client_id = e.client_id
     where e.id = $1 and e.status = 'processando'`, [id]);
  if (!job) return;
  const perfil = job.perfil as Contexto["perfil"];
  try {
    // Compacta em streaming: cada lote é escrito no gzip e descartado (memória baixa).
    const gz = new CompressionStream("gzip");
    const escritor = gz.writable.getWriter();
    const compactado = new Response(gz.readable).arrayBuffer();
    const enc = new TextEncoder();
    let cursor = job.cursor;
    let linhasParte = 0;
    let cabecalho = false;
    let acabou = false;
    while (linhasParte < LINHAS_POR_PARTE) {
      const r = await lote(job.pedido, perfil, cursor, Math.min(LINHAS_POR_LOTE, LINHAS_POR_PARTE - linhasParte));
      const colunas: Coluna[] = r.colunas;
      let bloco = "";
      if (!cabecalho) { bloco = "\uFEFF" + colunas.map((c) => c.nome).join(";") + "\r\n"; cabecalho = true; }
      bloco += r.linhas.map((l) => colunas.map((c) => csvCampo(c, l[c.id])).join(";")).join("\r\n");
      if (r.linhas.length) bloco += "\r\n";
      await escritor.write(enc.encode(bloco));
      linhasParte += r.linhas.length;
      cursor = r.proximo ?? cursor;
      if (r.linhas.length < LINHAS_POR_LOTE) { acabou = true; break; }
    }
    await escritor.close();
    const bytes = new Uint8Array(await compactado);
    const numero = job.partes.length + 1;
    const base = job.pedido.fonte === "pagar" ? "contas-a-pagar" : "contas-a-receber";
    const caminho = `${id}/${base}-parte-${String(numero).padStart(2, "0")}.csv.gz`;
    if (linhasParte > 0) {
      const { error } = await storage().upload(caminho, bytes, { contentType: "application/gzip" });
      if (error) throw error;
    }
    const total = job.linhas_processadas + linhasParte;
    await consulta(
      `update mcp.exportacoes set cursor = $2, partes = partes || $3::jsonb, linhas_processadas = $4,
         status = case when $5 then 'concluido' else 'processando' end,
         concluido_em = case when $5 then now() end
       where id = $1`,
      [id, JSON.stringify(cursor), JSON.stringify(linhasParte > 0 ? [caminho] : []), total, acabou]);
    if (!acabou) dispararProcessamento(id);
  } catch (e) {
    await consulta(`update mcp.exportacoes set status = 'erro', erro = $2 where id = $1`, [id, String(e)]);
  }
}

// ---------------------------------------------------------------- ferramenta status_exportacao

export async function statusExportacao(id: string, ctx: Contexto) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { status: "codigo_invalido" };
  const [job] = await consulta<{ status: string; total_linhas: number; linhas_processadas: number; partes: string[]; erro: string | null; criado_em: Date; pedido: Pedido }>(
    `select status, total_linhas, linhas_processadas, partes, erro, criado_em, pedido
     from mcp.exportacoes where id = $1 and client_id = $2`, [id, ctx.clientId]);
  if (!job) return { status: "nao_encontrada", orientacao_ao_claude: "Código não encontrado para este usuário." };
  if (job.status === "processando") {
    const pct = Math.round((100 * job.linhas_processadas) / Math.max(1, job.total_linhas));
    return {
      status: "processando", progresso: `${pct}%`,
      linhas: `${job.linhas_processadas.toLocaleString("pt-BR")} de ${job.total_linhas.toLocaleString("pt-BR")}`,
      orientacao_ao_claude: "Ainda gerando. Informe o progresso e peça para o usuário perguntar de novo em alguns minutos.",
    };
  }
  if (job.status === "erro") {
    return { status: "erro", detalhe: job.erro, orientacao_ao_claude: "Houve erro na geração. Sugira tentar de novo com um recorte menor." };
  }
  return {
    status: "pronto",
    total_linhas: job.total_linhas,
    arquivos: await Promise.all(job.partes.map(async (c, i) => ({ parte: i + 1, link_download: await link(c) }))),
    validade_links: "1 hora (se expirar, peça o status de novo para gerar links novos)",
    como_abrir: job.partes[0]?.endsWith(".gz")
      ? "Descompacte o .gz (7-Zip ou WinRAR) e abra o .csv no Excel, ou importe direto no Power BI."
      : "Abra direto no Excel.",
    orientacao_ao_claude: "Entregue os links e as instruções de abertura ao usuário. " +
      AVISO_COMPENSACAO[job.pedido?.fonte === "pagar" ? "pagar" : "receber"],
  };
}
