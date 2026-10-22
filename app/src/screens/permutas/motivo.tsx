// Permutas › Terrenos: modal que pede o motivo antes de inativar/reativar (cadastro ou unidade).
// Botão só libera com MOTIVO_MIN caracteres; o banco confere de novo.
import { useEffect, useState, type ReactNode } from 'react';
import { MOTIVO_MIN } from '../../lib/permutas';

export function ModalMotivo({ titulo, descricao, confirmar, perigo, onConfirmar, fechar }: {
  titulo: string; descricao: ReactNode; confirmar: string; perigo?: boolean;
  onConfirmar: (motivo: string) => Promise<void>; fechar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const n = motivo.trim().length;
  const ok = n >= MOTIVO_MIN && !enviando;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [enviando, fechar]);

  const enviar = async () => {
    if (!ok) return;
    setEnviando(true); setErro('');
    try { await onConfirmar(motivo.trim()); }
    catch (e: any) { setErro(e?.message || String(e)); setEnviando(false); }
  };

  return (
    <div className="pm-ov" onMouseDown={e => { if (e.target === e.currentTarget && !enviando) fechar(); }}>
      <div className="pm-modal pm-modal-sm" role="dialog" aria-modal="true" aria-labelledby="pm-mot-t">
        <div className="pm-mh">
          <div className={'pm-mic' + (perigo ? ' perigo' : '')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 5h14v10H9l-4 4V5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div className="pm-mt" id="pm-mot-t">{titulo}</div>
            <div className="pm-ms">{descricao}</div>
          </div>
        </div>
        <div className="pm-mb">
          <div className="pm-f">
            <label className="pm-cap" htmlFor="pm-mot">Motivo <span className="pm-req">*</span></label>
            <textarea id="pm-mot" className="pm-in" autoFocus value={motivo} disabled={enviando} placeholder="Descreva o motivo (fica no histórico)"
              onChange={e => setMotivo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }} />
            <span className="pm-hint">{n < MOTIVO_MIN ? `Mínimo de ${MOTIVO_MIN} caracteres (faltam ${MOTIVO_MIN - n}).` : 'Ctrl + Enter confirma.'}</span>
          </div>
          {erro ? <div className="pm-err">{erro}</div> : null}
        </div>
        <div className="pm-mf">
          <div className="r">
            <button type="button" className="pm-btn" onClick={fechar} disabled={enviando}>Cancelar</button>
            <button type="button" className={'pm-btn ' + (perigo ? 'danger' : 'prim')} onClick={enviar} disabled={!ok}>
              {enviando ? 'Salvando…' : confirmar}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
