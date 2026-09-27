// PDF da "Análise com IA" da Programação do dia e do Fluxo de caixa. As duas telas dividem
// cabeçalho, destaque, indicadores, pontos de atenção e rodapé; muda só o corpo:
//   Programação: empresas que precisam de aporte e os maiores pagamentos delas.
//   Fluxo: saldo consolidado dia a dia e as empresas que ficam negativas no período.
// jsPDF é carregado só quando o usuário pede o PDF.

type Card = { label: string; val: string; sub: string; tone?: 'neg' | 'aporte' };
type Ponto = { label: string; text: string; nivel: string };

/** Partes comuns às duas telas. */
type RelatorioIaBase = {
  periodo: string;
  geradoEm: string;
  geradoPor: string;
  fonte: string;
  headline: string;
  cards: Card[];
  pontos: Ponto[];
  arquivo: string;
};

export type RelatorioIaProg = RelatorioIaBase & {
  aportes: { cd: number; emp: string; saldo: number; tit: number; man: number; total: number; after: number; aporte: number; qtd: number }[];
  composicao: { emp: string; aporte: number; itens: { credor: string; tipo: string; venc: string; autorizado: string; val: number }[] }[];
};

export type RelatorioIaFluxo = RelatorioIaBase & {
  /** Consolidado de todas as empresas do filtro, um por dia do período. */
  dias: { dia: string; entradas: number; saidas: number; saldo: number }[];
  /** Empresas cujo saldo projetado fica negativo em algum dia do período. */
  negativas: { cd: number; emp: string; holding: boolean; caixa: number; entradas: number; saidas: number; menor: number; diaMenor: string; final: number; aporte: number }[];
  /** Total que a holding envia às SPEs no período. */
  totalAportes: number;
};

const INK = [17, 24, 39] as const;
const MUTED = [100, 116, 139] as const;
const FAINT = [148, 163, 184] as const;
const LINE = [238, 238, 241] as const;
const SOFT = [250, 250, 251] as const;
const ROXO = [124, 58, 237] as const;
const VERMELHO = [220, 38, 38] as const;
const NIVEL: Record<string, { cor: readonly [number, number, number]; fundo: readonly [number, number, number]; nome: string }> = {
  critico: { cor: [239, 68, 68], fundo: [254, 233, 233], nome: 'CRÍTICO' },
  atencao: { cor: [245, 158, 11], fundo: [255, 240, 221], nome: 'ATENÇÃO' },
  info: { cor: [100, 116, 139], fundo: [241, 241, 244], nome: 'INFORMATIVO' },
  positivo: { cor: [67, 185, 151], fundo: [225, 247, 239], nome: 'POSITIVO' },
};

const f2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// As fontes padrão do PDF só têm Latin-1: troca aspas curvas, travessões e afins.
const txt = (s: string) => String(s ?? '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—−]/g, '-').replace(/…/g, '...')
  .replace(/[  ]/g, ' ').replace(/[^\t\n\r -~¡-ÿ]/g, '');

/**
 * Abre o documento e desenha as partes comuns (cabeçalho, destaque, indicadores e pontos de
 * atenção). Devolve o documento e os utilitários para o corpo de cada tela continuar dali.
 */
async function iniciar(titulo: string, r: RelatorioIaBase) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = W - 2 * M;
  const TOPO = 16;
  const FIM = H - 16;
  const p = { y: 0 };

  const cor = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const fundo = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);
  const traco = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2]);
  const fonte = (size: number, style: 'normal' | 'bold' = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const quebra = (h: number) => { if (p.y + h > FIM) { doc.addPage(); p.y = TOPO; } };
  const secao = (t: string, dir?: string) => {
    quebra(16);
    fonte(8, 'bold'); cor(FAINT);
    doc.text(txt(t).toUpperCase(), M, p.y, { charSpace: 0.4 });
    if (dir) { fonte(8); doc.text(txt(dir), W - M, p.y, { align: 'right' }); }
    traco(LINE); doc.setLineWidth(0.3); doc.line(M, p.y + 2.2, W - M, p.y + 2.2);
    p.y += 7;
  };
  /** Faixa de aviso (ex.: "nenhuma empresa precisa de aporte"). */
  const aviso = (t: string) => {
    quebra(14);
    fundo([225, 247, 239]); doc.roundedRect(M, p.y, CW, 11, 2, 2, 'F');
    fonte(9, 'bold'); doc.setTextColor(37, 139, 108);
    doc.text(txt(t), M + 5, p.y + 7);
    p.y += 18;
  };
  const tabela = {
    theme: 'plain' as const,
    rowPageBreak: 'avoid' as const,
    margin: { left: M, right: M, top: TOPO, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: { top: 2.3, bottom: 2.3, left: 2, right: 2 }, textColor: [55, 65, 81] as [number, number, number], lineColor: [238, 238, 241] as [number, number, number], overflow: 'linebreak' as const },
    headStyles: { fontStyle: 'bold' as const, fontSize: 6.4, textColor: [148, 163, 184] as [number, number, number], fillColor: [250, 250, 251] as [number, number, number] },
    footStyles: { fontStyle: 'bold' as const, textColor: [17, 24, 39] as [number, number, number], fillColor: [244, 244, 246] as [number, number, number] },
    alternateRowStyles: { fillColor: [252, 252, 253] as [number, number, number] },
    bodyStyles: { lineWidth: { bottom: 0.2 } },
  };

  // ---- cabeçalho ----
  fundo(INK); doc.rect(0, 0, W, 40, 'F');
  fundo([65, 97, 255]); doc.rect(0, 40, W, 1, 'F');
  fundo([252, 235, 196]); doc.roundedRect(M, 11, 11, 11, 2.5, 2.5, 'F');
  traco([183, 121, 31]); doc.setLineWidth(0.45);
  // mesma estrela do ícone do modal (path 24x24, escala 0,5 mm)
  doc.lines([[1.6, 4.7], [4.4, 1.3], [-4.4, 1.3], [-1.6, 4.7], [-1.6, -4.7], [-4.4, -1.3], [4.4, -1.3], [1.6, -4.7]], M + 5.5, 16.5 - 3, [0.5, 0.5], 'S', true);
  fonte(7.5, 'bold'); doc.setTextColor(167, 178, 255);
  doc.text('B2 GESTÃO E OPERAÇÕES  ·  FINANCEIRO', M + 15, 14.2, { charSpace: 0.3 });
  fonte(16, 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(txt(titulo), M + 15, 21.5);
  fonte(9); doc.setTextColor(203, 213, 225);
  doc.text(txt(`Período ${r.periodo}`), M + 15, 27.5);
  fonte(7.5); doc.setTextColor(148, 163, 184);
  doc.text(txt(`Gerado em ${r.geradoEm}`), W - M, 14.2, { align: 'right' });
  doc.text(txt(r.geradoPor), W - M, 18.4, { align: 'right' });
  doc.text(txt(r.fonte), W - M, 22.6, { align: 'right' });
  p.y = 50;

  // ---- destaque ----
  fonte(10.5, 'bold');
  const hl = doc.splitTextToSize(txt(r.headline), CW - 14);
  const hh = hl.length * 4.8 + 11;
  fundo([255, 248, 235]); doc.roundedRect(M, p.y, CW, hh, 2.5, 2.5, 'F');
  fundo([245, 158, 11]); doc.rect(M, p.y, 1.4, hh, 'F');
  fonte(7, 'bold'); doc.setTextColor(180, 83, 9);
  doc.text('PRINCIPAL PONTO', M + 7, p.y + 6, { charSpace: 0.4 });
  fonte(10.5, 'bold'); cor(INK);
  doc.text(hl, M + 7, p.y + 11.2, { lineHeightFactor: 1.35 });
  p.y += hh + 7;

  // ---- indicadores ----
  const n = r.cards.length, gap = 3, cw = (CW - gap * (n - 1)) / n, ch = 22;
  r.cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    fundo([255, 255, 255]); traco(LINE); doc.setLineWidth(0.3);
    doc.roundedRect(x, p.y, cw, ch, 2, 2, 'FD');
    fonte(6.3, 'bold'); cor(FAINT);
    doc.text(txt(c.label).toUpperCase(), x + 3.5, p.y + 6, { maxWidth: cw - 6, charSpace: 0.2 });
    fonte(10.5, 'bold'); cor(c.tone === 'neg' ? VERMELHO : c.tone === 'aporte' ? ROXO : INK);
    doc.text(txt(c.val), x + 3.5, p.y + 13);
    fonte(6.3); cor(MUTED);
    doc.text(doc.splitTextToSize(txt(c.sub), cw - 6).slice(0, 2), x + 3.5, p.y + 17.6);
  });
  p.y += ch + 10;

  // ---- pontos de atenção ----
  secao('Pontos de atenção', `${r.pontos.length} ${r.pontos.length === 1 ? 'ponto' : 'pontos'}`);
  for (const pt of r.pontos) {
    const nv = NIVEL[pt.nivel] || NIVEL.info;
    fonte(9);
    const linhas = doc.splitTextToSize(txt(pt.text), CW - 12);
    const h = linhas.length * 4.3 + 13;
    quebra(h + 3);
    fundo(SOFT); traco(LINE); doc.setLineWidth(0.3);
    doc.roundedRect(M, p.y, CW, h, 2, 2, 'FD');
    fundo(nv.cor); doc.rect(M, p.y, 1.2, h, 'F');
    fonte(9.5, 'bold'); cor(INK);
    doc.text(txt(pt.label), M + 6, p.y + 6.3);
    fonte(6, 'bold');
    const bw = doc.getTextWidth(nv.nome) + 5;
    fundo(nv.fundo); doc.roundedRect(W - M - 4 - bw, p.y + 2.8, bw, 4.6, 2.3, 2.3, 'F');
    cor(nv.cor); doc.text(nv.nome, W - M - 4 - bw / 2, p.y + 5.9, { align: 'center' });
    fonte(9); doc.setTextColor(75, 85, 99);
    doc.text(linhas, M + 6, p.y + 11.3, { lineHeightFactor: 1.35 });
    p.y += h + 3;
  }
  p.y += 6;

  /** Nota final e rodapé em todas as páginas; devolve o documento (para baixar ou anexar). */
  const concluir = (nota: string) => {
    quebra(10);
    fonte(6.8); cor(FAINT);
    doc.text(doc.splitTextToSize(txt(nota), CW), M, p.y);
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      traco(LINE); doc.setLineWidth(0.2); doc.line(M, H - 11, W - M, H - 11);
      fonte(6.5); doc.setTextColor(176, 184, 196);
      doc.text('Departamento de Sistemas | B2', W / 2, H - 7, { align: 'center' });
      doc.text(`${i}/${paginas}`, W - M, H - 7, { align: 'right' });
    }
    return doc;
  };

  return { doc, autoTable, p, secao, aviso, quebra, tabela, concluir };
}

export async function montarPdfIaProg(r: RelatorioIaProg) {
  const { doc, autoTable, p, secao, aviso, tabela, concluir } = await iniciar('Análise com IA · Programação do dia', r);

  // ---- empresas que precisam de aporte ----
  const totAporte = r.aportes.reduce((t, a) => t + a.aporte, 0);
  secao('Empresas que precisam de aporte', r.aportes.length ? `${r.aportes.length} ${r.aportes.length === 1 ? 'empresa' : 'empresas'} · R$ ${f2(totAporte)}` : '');
  if (r.aportes.length) {
    autoTable(doc, {
      ...tabela,
      startY: p.y,
      head: [['CÓD', 'EMPRESA', 'SALDO INICIAL', 'TÍTULOS SIENGE', 'MANUAIS', 'TOTAL A PAGAR', 'SALDO APÓS', 'APORTE']],
      body: r.aportes.map(a => [String(a.cd), txt(a.emp), f2(a.saldo), a.tit ? f2(a.tit) : '-', a.man ? f2(a.man) : '-', f2(a.total), f2(a.after), f2(a.aporte)]),
      showFoot: 'lastPage',
      foot: [['', `Total · ${r.aportes.length} ${r.aportes.length === 1 ? 'empresa' : 'empresas'}`,
        f2(r.aportes.reduce((t, a) => t + a.saldo, 0)), f2(r.aportes.reduce((t, a) => t + a.tit, 0)), f2(r.aportes.reduce((t, a) => t + a.man, 0)),
        f2(r.aportes.reduce((t, a) => t + a.total, 0)), f2(r.aportes.reduce((t, a) => t + a.after, 0)), f2(totAporte)]],
      columnStyles: {
        0: { cellWidth: 10, textColor: [100, 116, 139] },
        1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [17, 24, 39] },
        2: { halign: 'right', cellWidth: 21 }, 3: { halign: 'right', cellWidth: 21 }, 4: { halign: 'right', cellWidth: 17 },
        5: { halign: 'right', cellWidth: 21 }, 6: { halign: 'right', cellWidth: 21, textColor: [220, 38, 38] },
        7: { halign: 'right', cellWidth: 23, fontStyle: 'bold', textColor: [124, 58, 237] },
      },
      didParseCell: d => { if (d.section !== 'body' && d.column.index >= 2) d.cell.styles.halign = 'right'; if (d.section === 'foot' && d.column.index === 7) d.cell.styles.textColor = [124, 58, 237]; },
    });
    p.y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    aviso('Nenhuma empresa precisa de aporte: o saldo inicial cobre os pagamentos do período.');
  }

  // ---- composição dos pagamentos das empresas com aporte ----
  if (r.composicao.length) {
    secao('Maiores pagamentos das empresas com aporte', 'até 5 por empresa');
    autoTable(doc, {
      ...tabela,
      startY: p.y,
      head: [['CREDOR / DESCRIÇÃO', 'TIPO', 'VENCIMENTO', 'AUTORIZADO', 'VALOR']],
      body: r.composicao.flatMap(g => [
        [{ content: `${txt(g.emp)}   ·   aporte necessário R$ ${f2(g.aporte)}`, colSpan: 5, styles: { fontStyle: 'bold' as const, textColor: [17, 24, 39] as [number, number, number], fillColor: [241, 233, 255] as [number, number, number], cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 2 } } }],
        ...g.itens.map(c => [txt(c.credor), c.tipo, c.venc, c.autorizado, f2(c.val)]),
      ]),
      alternateRowStyles: {},
      columnStyles: {
        0: { cellWidth: 'auto', textColor: [17, 24, 39], cellPadding: { top: 2.3, bottom: 2.3, left: 6, right: 2 } },
        1: { cellWidth: 17 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      },
      didParseCell: d => {
        if (d.column.index === 4) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.column.index === 3 && d.cell.raw === 'Não') { d.cell.styles.textColor = [180, 83, 9]; d.cell.styles.fontStyle = 'bold'; }
      },
    });
    p.y = (doc as any).lastAutoTable.finalY + 8;
  }

  return concluir('Valores em R$. Aporte necessário = total a pagar no período - saldo inicial informado em Saldos bancários, por empresa. Análise gerada automaticamente; confirme os números antes de liberar pagamentos.');
}

export async function montarPdfIaFluxo(r: RelatorioIaFluxo) {
  const { doc, autoTable, p, secao, aviso, tabela, concluir } = await iniciar('Análise com IA · Fluxo de caixa', r);
  const vermelhoSeNeg = (d: any, cols: number[]) => {
    if (d.section === 'body' && cols.includes(d.column.index) && typeof d.cell.raw === 'string' && d.cell.raw.startsWith('-') && d.cell.raw !== '-') d.cell.styles.textColor = [220, 38, 38];
  };

  // ---- saldo consolidado por dia ----
  secao('Saldo consolidado por dia', `${r.dias.length} ${r.dias.length === 1 ? 'dia' : 'dias'}`);
  autoTable(doc, {
    ...tabela,
    startY: p.y,
    head: [['DIA', 'ENTRADAS', 'SAÍDAS', 'RESULTADO DO DIA', 'SALDO PROJETADO']],
    body: r.dias.map(d => [d.dia, d.entradas ? f2(d.entradas) : '-', d.saidas ? f2(-d.saidas) : '-', f2(d.entradas - d.saidas), f2(d.saldo)]),
    showFoot: 'lastPage',
    foot: [['Total do período', f2(r.dias.reduce((t, d) => t + d.entradas, 0)), f2(-r.dias.reduce((t, d) => t + d.saidas, 0)),
      f2(r.dias.reduce((t, d) => t + d.entradas - d.saidas, 0)), r.dias.length ? f2(r.dias[r.dias.length - 1].saldo) : '-']],
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold', textColor: [17, 24, 39] },
      1: { halign: 'right', cellWidth: 32 }, 2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 34 }, 4: { halign: 'right', cellWidth: 36, fontStyle: 'bold', textColor: [17, 24, 39] },
    },
    didParseCell: d => {
      if (d.section !== 'body' && d.column.index >= 1) d.cell.styles.halign = 'right';
      if (d.section === 'body' && d.column.index === 1 && d.cell.raw !== '-') d.cell.styles.textColor = [37, 139, 108];
      vermelhoSeNeg(d, [2, 3, 4]);
    },
  });
  p.y = (doc as any).lastAutoTable.finalY + 10;

  // ---- empresas com saldo negativo ----
  secao('Empresas com saldo negativo no período', r.negativas.length
    ? `${r.negativas.length} ${r.negativas.length === 1 ? 'empresa' : 'empresas'}${r.totalAportes ? ` · aportes R$ ${f2(r.totalAportes)}` : ''}`
    : '');
  if (r.negativas.length) {
    autoTable(doc, {
      ...tabela,
      startY: p.y,
      head: [['CÓD', 'EMPRESA', 'CAIXA INICIAL', 'ENTRADAS', 'SAÍDAS', 'MENOR SALDO', 'SALDO FINAL', 'APORTE']],
      body: r.negativas.map(e => [String(e.cd), txt(e.holding ? `${e.emp} (holding)` : e.emp), f2(e.caixa), e.entradas ? f2(e.entradas) : '-',
        e.saidas ? f2(-e.saidas) : '-', `${f2(e.menor)}\n${e.diaMenor}`, f2(e.final), e.holding ? '-' : f2(e.aporte)]),
      columnStyles: {
        0: { cellWidth: 10, textColor: [100, 116, 139] },
        1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [17, 24, 39] },
        2: { halign: 'right', cellWidth: 21 }, 3: { halign: 'right', cellWidth: 21 }, 4: { halign: 'right', cellWidth: 21 },
        5: { halign: 'right', cellWidth: 21 }, 6: { halign: 'right', cellWidth: 21 },
        7: { halign: 'right', cellWidth: 21, fontStyle: 'bold', textColor: [124, 58, 237] },
      },
      didParseCell: d => {
        if (d.section !== 'body' && d.column.index >= 2) d.cell.styles.halign = 'right';
        vermelhoSeNeg(d, [4, 5, 6]);
      },
    });
    p.y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    aviso('Nenhuma empresa fica com saldo negativo no período projetado.');
  }

  return concluir('Valores em R$. Saldo projetado = caixa inicial + entradas (parcelas a receber e lançamentos manuais de entrada) - saídas (parcelas a pagar e lançamentos manuais de saída), dia a dia. Aporte = quanto a holding envia para a SPE não ficar negativa; no consolidado os aportes se anulam. Análise gerada automaticamente; confirme os números antes de tomar decisões.');
}

export async function gerarPdfIaProg(r: RelatorioIaProg) {
  (await montarPdfIaProg(r)).save(r.arquivo);
}

export async function gerarPdfIaFluxo(r: RelatorioIaFluxo) {
  (await montarPdfIaFluxo(r)).save(r.arquivo);
}

/** Conteúdo do PDF em base64 (sem o prefixo data:), para anexar no e-mail. */
export function pdfBase64(doc: { output(tipo: 'datauristring'): string }) {
  const uri = doc.output('datauristring');
  return uri.slice(uri.indexOf(',') + 1);
}
