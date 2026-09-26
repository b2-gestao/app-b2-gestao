/**
 * Saves a Blob as a file. The link goes into the DOM before the click (Firefox/Safari and
 * embedded webviews ignore a click on a detached <a download>), and the object URL is kept
 * alive for a minute: revoking it right after the click cancels the download in browsers
 * that fetch the blob asynchronously. Falls back to opening the file in a new tab.
 */
export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    window.open(url, '_blank', 'noopener');
  }
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return nome;
}

/** CSV with BOM (Excel opens UTF-8 correctly) and CRLF line breaks. */
export const baixarCsv = (lines: string[], nome: string) =>
  baixarArquivo(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nome);
