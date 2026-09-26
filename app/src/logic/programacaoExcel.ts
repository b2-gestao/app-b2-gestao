import { zipSync, strToU8 } from 'fflate';

/**
 * Programação do dia → real .xlsx (two sheets: one row per company, one row per item).
 * Minimal SpreadsheetML writer: inline strings, numeric cells and SUM formulas, so the
 * user can filter/sum in Excel without re-parsing formatted text.
 */

type Cell = string | number | null | { f: string; v: number } | { d: string };
type Col = { head: string; width: number; style?: number };

// Style ids (cellXfs order in STYLES).
const S_HEAD = 1, S_NUM = 2, S_TOT_LABEL = 3, S_TOT_NUM = 4, S_DATE = 5, S_INT = 6, S_TOT_INT = 7;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red]-#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE1F7EF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF94A3B8"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const esc = (v: string) => v
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colName = (i: number) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

// Excel serial date (1900 system).
const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

function cellXml(ref: string, c: Cell, style: number) {
  const s = style ? ` s="${style}"` : '';
  if (c == null || c === '') return style ? `<c r="${ref}"${s}/>` : '';
  if (typeof c === 'number') return `<c r="${ref}"${s}><v>${Number.isFinite(c) ? c : 0}</v></c>`;
  if (typeof c === 'string') return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>`;
  if ('f' in c) return `<c r="${ref}"${s}><f>${esc(c.f)}</f><v>${c.v}</v></c>`;
  return /^\d{4}-\d{2}-\d{2}$/.test(c.d) ? `<c r="${ref}" s="${S_DATE}"><v>${serial(c.d)}</v></c>` : '';
}

/** rows: data rows; total: optional last row (bold, top border). */
function sheetXml(cols: Col[], rows: Cell[][], total?: Cell[]) {
  const last = colName(cols.length - 1);
  const lines: string[] = [];
  lines.push(`<row r="1">${cols.map((c, i) => cellXml(`${colName(i)}1`, c.head, S_HEAD)).join('')}</row>`);
  rows.forEach((r, ri) => {
    const n = ri + 2;
    lines.push(`<row r="${n}">${r.map((c, i) => cellXml(`${colName(i)}${n}`, c, cols[i].style || 0)).join('')}</row>`);
  });
  if (total) {
    const n = rows.length + 2;
    lines.push(`<row r="${n}">${total.map((c, i) => {
      const base = cols[i].style;
      const st = base === S_NUM ? S_TOT_NUM : base === S_INT ? S_TOT_INT : S_TOT_LABEL;
      return cellXml(`${colName(i)}${n}`, c, st);
    }).join('')}</row>`);
  }
  const lastRow = rows.length + 1 + (total ? 1 : 0);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${last}${Math.max(lastRow, 1)}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('')}</cols>
<sheetData>${lines.join('')}</sheetData>
<autoFilter ref="A1:${last}${rows.length + 1}"/>
</worksheet>`;
}

function workbook(sheets: { name: string; xml: string }[]) {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames>${sheets.map((s, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name)}'!$A$1</definedName>`).join('')}</definedNames>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(s.xml); });
  return zipSync(files, { level: 6 });
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** groups: the companies currently selected in the filter (same shape as progLiveGroups/pgSeed). */
export function exportProgramacaoXlsx(groups: any[], from: string, to: string) {
  const empCols: Col[] = [
    { head: 'Código', width: 9, style: S_INT },
    { head: 'Empresa', width: 42 },
    { head: 'Saldo inicial', width: 16, style: S_NUM },
    { head: 'Títulos Sienge', width: 16, style: S_NUM },
    { head: 'Manuais', width: 14, style: S_NUM },
    { head: 'Total a pagar', width: 16, style: S_NUM },
    { head: 'Saldo após', width: 16, style: S_NUM },
    { head: 'Aporte necessário', width: 18, style: S_NUM },
    { head: 'Itens na programação', width: 20, style: S_INT },
    { head: 'Itens fora', width: 11, style: S_INT },
  ];
  const itemCols: Col[] = [
    { head: 'Código', width: 9, style: S_INT },
    { head: 'Empresa', width: 42 },
    { head: 'Tipo', width: 10 },
    { head: 'Credor / descrição', width: 40 },
    { head: 'Detalhe', width: 44 },
    { head: 'Vencimento', width: 12 },
    { head: 'Valor', width: 16, style: S_NUM },
    { head: 'Situação', width: 22 },
  ];

  const tot = { saldo: 0, tit: 0, man: 0, aporte: 0, on: 0, off: 0 };
  const empRows: Cell[][] = [];
  const itemRows: Cell[][] = [];
  for (const g of groups) {
    const on = g.items.filter((i: any) => i.on);
    const tit = r2(on.filter((i: any) => i.tag === 'Título').reduce((t: number, i: any) => t + i.val, 0));
    const man = r2(on.filter((i: any) => i.tag === 'Manual').reduce((t: number, i: any) => t + i.val, 0));
    const after = r2(g.saldo - tit - man);
    const aporte = after < 0 ? -after : 0;
    const n = empRows.length + 2;
    empRows.push([
      Number(g.cd) || String(g.cd), g.emp, r2(g.saldo), tit, man,
      { f: `D${n}+E${n}`, v: r2(tit + man) },
      { f: `C${n}-F${n}`, v: after },
      { f: `MAX(0,-G${n})`, v: aporte },
      on.length, g.items.length - on.length,
    ]);
    tot.saldo += g.saldo; tot.tit += tit; tot.man += man; tot.aporte += aporte; tot.on += on.length; tot.off += g.items.length - on.length;
    for (const it of g.items) {
      itemRows.push([
        Number(g.cd) || String(g.cd), g.emp, it.tag, it.title, it.sub || '',
        it.due ? { d: it.due } : '', r2(it.val), it.on ? 'Na programação' : 'Fora da programação',
      ]);
    }
  }
  const last = empRows.length + 1;
  const sum = (col: string, v: number) => ({ f: `SUBTOTAL(9,${col}2:${col}${last})`, v: r2(v) });
  const empTotal: Cell[] = [
    '', 'Total', sum('C', tot.saldo), sum('D', tot.tit), sum('E', tot.man), sum('F', tot.tit + tot.man),
    sum('G', tot.saldo - tot.tit - tot.man), sum('H', tot.aporte), sum('I', tot.on), sum('J', tot.off),
  ];

  const bytes = workbook([
    { name: 'Por empresa', xml: sheetXml(empCols, empRows, empRows.length ? empTotal : undefined) },
    { name: 'Itens', xml: sheetXml(itemCols, itemRows) },
  ]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = from === to ? `programacao_${from}.xlsx` : `programacao_${from}_a_${to}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return a.download;
}
