// Permutas › Cadastro: painel "Importar do contrato" da modal do permutante.
// Só a interface (modo importar/manual, área de soltar o PDF, etapas da leitura e resultado); a leitura e o
// preenchimento dos campos ficam na modal (PermutaModal.tsx), que tem o estado do formulário.
import { useState } from 'react';
import { tamanho, type AvisoImportacao } from '../../lib/permutas';

export type ModoCadastro = 'importar' | 'manual';
export type FaseImportacao =
  | { fase: 'ocioso' }
  | { fase: 'lendo'; arquivo: File }
  | { fase: 'erro'; erro: string }
  | { fase: 'ok'; arquivo: string; avisos: AvisoImportacao[]; campos: number; unidades: number; cache: boolean; paginas: string | null };

/** Etapas mostradas durante a leitura; a última (unidades e valores) roda na tela, depois da resposta da IA. */
export const PASSOS_IA = [
  'Enviando o PDF',
  'Lendo o contrato',
  'Identificando permutante, matrícula e área',
  'Conferindo a empresa pelo CNPJ',
  'Buscando unidades e valores na tabela de vendas',
];

const IcIa = ({ s = 15 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="currentColor" /></svg>
);
const IcLapis = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
);
const IcCheck = ({ s = 10 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function PainelImportacao(p: {
  modo: ModoCadastro; setModo: (m: ModoCadastro) => void;
  imp: FaseImportacao; passo: number; editando: boolean;
  importar: (f: File | undefined) => void; recomecar: () => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  const lendo = p.imp.fase === 'lendo';
  const escolher = (
    <input type="file" accept="application/pdf,.pdf" hidden onChange={e => { p.importar(e.target.files?.[0]); e.target.value = ''; }} />
  );

  return (
    <div className="pm-impw">
      <div className="pm-modo" data-modo={p.modo} role="tablist" aria-label="Como cadastrar">
        <span className="ind" aria-hidden="true" />
        <button type="button" role="tab" aria-selected={p.modo === 'importar'} disabled={lendo} onClick={() => p.setModo('importar')}>
          <IcIa />{p.editando ? 'Atualizar pelo contrato' : 'Importar do contrato'}
        </button>
        <button type="button" role="tab" aria-selected={p.modo === 'manual'} disabled={lendo} onClick={() => p.setModo('manual')}>
          <IcLapis />Preencher manualmente
        </button>
      </div>

      {p.modo === 'manual' ? null : (
        <div className={'pm-imp' + (arrastando ? ' over' : '')}
          onDragOver={e => { e.preventDefault(); if (!lendo) setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={e => { e.preventDefault(); setArrastando(false); if (!lendo) p.importar(e.dataTransfer.files[0]); }}>

          {p.imp.fase === 'ocioso' || p.imp.fase === 'erro' ? (
            <>
              <label className="pm-imp-drop">
                <span className="pm-imp-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0l-4.5 4.5M12 4l4.5 4.5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <span className="tx">
                  <b>Arraste o contrato de permuta aqui</b>
                  <span className="s">{p.editando
                    ? 'PDF do contrato ou da escritura. A IA preenche só os campos vazios e o arquivo entra nos documentos.'
                    : 'PDF do compromisso ou da escritura. A IA preenche o cadastro e o arquivo já entra nos documentos.'}</span>
                </span>
                <span className="pm-btn sm prim">Escolher PDF</span>
                {escolher}
              </label>
              {p.imp.fase === 'erro' ? <div className="pm-err">{p.imp.erro}</div> : null}
            </>
          ) : null}

          {p.imp.fase === 'lendo' ? (
            <>
              <div className="pm-imp-file">
                <span className="pm-fi pdf">PDF</span>
                <div className="tx">
                  <b title={p.imp.arquivo.name}>{p.imp.arquivo.name}</b>
                  <span className="s">{tamanho(p.imp.arquivo.size)} · {p.passo === 0 ? 'enviando…' : 'na fila dos documentos'}</span>
                  <div className="pm-imp-prog"><i style={{ width: p.passo === 0 ? '45%' : '100%' }} /></div>
                </div>
                {p.passo > 0 ? <span className="pm-chip ok pm-pop"><i />Anexado</span> : null}
              </div>
              <div className="pm-imp-steps" aria-live="polite">
                {PASSOS_IA.map((t, i) => (
                  <div key={t} className={'pm-imp-step' + (i < p.passo ? ' ok' : i === p.passo ? ' on' : '')}>
                    <i>{i < p.passo ? <IcCheck /> : null}</i>{t}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {p.imp.fase === 'ok' ? (
            <>
              <div className="pm-imp-h">
                <span className="pm-imp-ok"><IcCheck s={17} /></span>
                <div className="tx">
                  <b>Contrato importado</b>
                  <span className="s">
                    {p.imp.campos} campo{p.imp.campos === 1 ? '' : 's'} e {p.imp.unidades} unidade{p.imp.unidades === 1 ? '' : 's'} preenchido{p.imp.campos + p.imp.unidades === 1 ? '' : 's'}
                    {' · '}confira os marcados com <span className="pm-tagia">IA</span> antes de salvar
                    {p.imp.paginas ? ` · lidas ${p.imp.paginas} páginas` : ''}{p.imp.cache ? ' · leitura reaproveitada' : ''}
                  </span>
                </div>
                <button type="button" className="pm-btn sm" onClick={p.recomecar}>Trocar contrato</button>
              </div>
              {p.imp.avisos.length ? (
                <div className="pm-imp-avs">
                  {p.imp.avisos.map((a, i) => <div key={i} className={'pm-imp-av ' + a.nivel} style={{ animationDelay: i * 60 + 'ms' }}><i />{a.texto}</div>)}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
