// Permutas › Terrenos: "Notificar por e-mail". Abre depois de salvar um permutante novo (pergunta antes) ou
// pelo ícone de envelope da modal. Destinatários: usuários ativos do B2 (busca por nome, e-mail ou departamento)
// ou e-mail digitado. O corpo é montado na edge function app-email (tipo "permuta"), que confere a permissão.
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent as TeclaEvent } from 'react';
import { EMAIL_RE, MAX_ANEXO_EMAIL, MAX_DESTINATARIOS, calcular, m2, tamanho, type Destinatario, type Permuta } from '../../lib/permutas';
import { semAcento } from './comum';

const MAX_SUGESTOES = 6;
type Escolhido = { email: string; nome: string | null };

const IcEmail = ({ s = 19 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5h16v11H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M4.5 7l7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IcNotificar = () => <IcEmail s={15} />;

const iniciais = (t: string) => t.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

export function ModalNotificar({ permuta, novo, assunto, destinatarios, enviar, toast, fechar }: {
  permuta: Permuta;
  /** Cadastro novo: pergunta antes se deseja notificar. */
  novo: boolean;
  assunto: string;
  destinatarios: () => Promise<Destinatario[]>;
  enviar: (para: string[], anexar: boolean) => Promise<void>;
  toast: (m: string) => void;
  fechar: () => void;
}) {
  const [passo, setPasso] = useState<'pergunta' | 'selecionar'>(novo ? 'pergunta' : 'selecionar');
  const [usuarios, setUsuarios] = useState<Destinatario[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Escolhido[]>([]);
  const [ativo, setAtivo] = useState(0);
  const [erro, setErroTxt] = useState('');
  // Cada erro novo reinicia a animação de "tremida" da mensagem.
  const [erroN, setErroN] = useState(0);
  const setErro = (m: string) => { setErroTxt(m); if (m) setErroN(n => n + 1); };
  // A lista de usuários só é buscada uma vez, ao abrir a seleção.
  const [carregando, setCarregando] = useState(true);
  const [fase, setFase] = useState<'editar' | 'enviando' | 'enviado'>('editar');
  const [enviadoPara, setEnviadoPara] = useState<string[]>([]);
  const enviando = fase === 'enviando';
  const busca = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const contrato = useMemo(() => [...permuta.anexos].reverse().find(a => a.tipo === 'Contrato' && a.storage_path) || null, [permuta.anexos]);
  const grande = !!contrato && contrato.tamanho > MAX_ANEXO_EMAIL;
  const [anexar, setAnexar] = useState(!!contrato && !grande);

  useEffect(() => {
    if (passo !== 'selecionar') return;
    let vivo = true;
    destinatarios().then(l => { if (vivo) setUsuarios(l); }).catch(() => { /* sem sugestões: segue com e-mail digitado */ })
      .finally(() => { if (vivo) setCarregando(false); });
    busca.current?.focus();
    return () => { vivo = false; };
  }, [passo, destinatarios]);

  // Captura: o Esc fecha só esta janela, não a modal do permutante que está por baixo.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.stopPropagation(); if (!enviando) fechar(); };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [enviando, fechar]);

  const termo = semAcento(q.trim());
  const sugestoes = useMemo(() => {
    if (!termo) return [];
    const ja = new Set(sel.map(s => s.email));
    return usuarios.filter(u => !ja.has(u.email.toLowerCase())
      && [u.nome, u.email, u.departamento || ''].some(t => semAcento(t).includes(termo))).slice(0, MAX_SUGESTOES);
  }, [termo, usuarios, sel]);
  const digitado = q.trim().toLowerCase();
  const podeNovo = EMAIL_RE.test(digitado) && !sel.some(s => s.email === digitado) && !sugestoes.some(u => u.email.toLowerCase() === digitado);
  const opcoes = sugestoes.length + (podeNovo ? 1 : 0);

  const adicionar = (email: string, nome: string | null = null) => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) { setErro(`E-mail inválido: ${e}`); return; }
    if (sel.length >= MAX_DESTINATARIOS && !sel.some(s => s.email === e)) { setErro(`No máximo ${MAX_DESTINATARIOS} destinatários por envio.`); return; }
    const conhecido = usuarios.find(u => u.email.toLowerCase() === e);
    setSel(l => (l.some(s => s.email === e) ? l : [...l, { email: e, nome: nome || conhecido?.nome || null }]));
    setQ(''); setAtivo(0); setErro('');
    busca.current?.focus();
  };
  const escolher = (i: number) => {
    if (i < sugestoes.length) adicionar(sugestoes[i].email, sugestoes[i].nome);
    else if (podeNovo) adicionar(digitado);
  };
  const teclar = (e: TeclaEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && opcoes) { e.preventDefault(); setAtivo(a => (a + 1) % opcoes); }
    else if (e.key === 'ArrowUp' && opcoes) { e.preventDefault(); setAtivo(a => (a - 1 + opcoes) % opcoes); }
    else if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      if (!q.trim()) return;
      e.preventDefault();
      if (opcoes) escolher(Math.min(ativo, opcoes - 1)); else adicionar(q);
    } else if (e.key === 'Backspace' && !q && sel.length) setSel(l => l.slice(0, -1));
  };
  // Colar "a@x.com; b@y.com" entra como vários.
  const colar = (e: ClipboardEvent<HTMLInputElement>) => {
    const partes = e.clipboardData.getData('text').split(/[\s,;]+/).filter(Boolean);
    if (partes.length < 2) return;
    e.preventDefault();
    const validos = partes.map(p => p.toLowerCase()).filter(p => EMAIL_RE.test(p));
    const invalidos = partes.filter(p => !EMAIL_RE.test(p.toLowerCase()));
    setSel(l => {
      const novos = validos.filter((v, i) => validos.indexOf(v) === i && !l.some(s => s.email === v))
        .map(v => ({ email: v, nome: usuarios.find(u => u.email.toLowerCase() === v)?.nome || null }));
      return [...l, ...novos].slice(0, MAX_DESTINATARIOS);
    });
    setErro(invalidos.length ? `E-mail inválido: ${invalidos.join(', ')}` : '');
  };

  const confirmar = async () => {
    if (enviando) return;
    const pendente = q.trim().toLowerCase();
    if (pendente && !EMAIL_RE.test(pendente)) { setErro(`E-mail inválido: ${pendente}`); return; }
    const para = [...new Set([...sel.map(s => s.email), ...(pendente ? [pendente] : [])])];
    if (!para.length) { setErro('Informe ao menos um e-mail.'); return; }
    if (para.length > MAX_DESTINATARIOS) { setErro(`No máximo ${MAX_DESTINATARIOS} destinatários por envio.`); return; }
    setFase('enviando'); setErro('');
    try {
      await enviar(para, anexar);
      toast(para.length === 1 ? `E-mail enviado para ${para[0]}` : `E-mail enviado para ${para.length} destinatários`);
      // Mostra a confirmação animada e fecha sozinho.
      setEnviadoPara(para); setFase('enviado');
      timer.current = window.setTimeout(fechar, 1700);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível enviar o e-mail.');
      setFase('editar');
    }
  };

  const area = calcular(permuta).area;
  const ativas = permuta.unidades.filter(u => u.ativo !== false).length;
  const resumo = [permuta.num_matricula ? `Matr. ${permuta.num_matricula}` : null, area == null ? null : `${m2(area)} m²`,
    ativas ? `${ativas} ${ativas === 1 ? 'unidade' : 'unidades'}` : null].filter(Boolean).join(' · ');

  if (passo === 'pergunta') {
    return (
      <div className="pm-ov" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
        <div className="pm-modal pm-nt-ask" role="dialog" aria-modal="true" aria-labelledby="pm-nt-t">
          <div className="pm-nt-ask-b">
            <div className="pm-nt-ic"><IcEmail s={22} /></div>
            <div>
              <div className="pm-mt" id="pm-nt-t">Permutante adicionado</div>
              <div className="pm-nt-ask-s">Deseja notificar alguém por e-mail sobre este cadastro?</div>
            </div>
            <div className="pm-nt-card">
              <div className="pm-mono">{iniciais(permuta.permutante) || '—'}</div>
              <div style={{ minWidth: 0 }}>
                <div className="pm-sum-n pm-ell">{permuta.permutante}</div>
                {resumo ? <div className="pm-sum-o pm-ell">{resumo}</div> : null}
              </div>
            </div>
          </div>
          <div className="pm-mf">
            <button type="button" className="pm-btn pm-nt-grow" onClick={fechar}>Agora não</button>
            <button type="button" className="pm-btn prim pm-nt-grow pm-nt-send" autoFocus onClick={() => setPasso('selecionar')}>
              <svg className="aviao" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12l16-7-6 15-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
              Notificar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-ov" onMouseDown={e => { if (e.target === e.currentTarget && !enviando) fechar(); }}>
      <div className={'pm-modal pm-nt' + (fase === 'enviando' ? ' sending' : '')} role="dialog" aria-modal="true" aria-labelledby="pm-nt-t" aria-busy={fase === 'enviando'}>
        {fase === 'enviando' ? <div className="pm-nt-prog" aria-hidden="true"><i /></div> : null}
        <div className="pm-mh">
          <div className="pm-mic"><IcEmail /></div>
          <div style={{ minWidth: 0 }}>
            <div className="pm-mt" id="pm-nt-t">Notificar por e-mail</div>
            <div className="pm-ms pm-ell">{permuta.permutante}{resumo ? ` · ${resumo}` : ''}</div>
          </div>
          <button type="button" className="pm-x" aria-label="Fechar" title="Fechar" onClick={fechar} disabled={enviando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
          </button>
        </div>
        {fase === 'enviado' ? (
          <div className="pm-nt-ok" role="status">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
              <circle className="c" cx="28" cy="28" r="25" stroke="currentColor" strokeWidth="2.5" />
              <path className="v" d="M18 28.5l7 7 13-14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <b>E-mail enviado</b>
            <span>{enviadoPara.length === 1 ? `Para ${enviadoPara[0]}` : `Para ${enviadoPara.length} destinatários`}{anexar && contrato && !grande ? ', com o contrato anexo' : ''}.</span>
          </div>
        ) : (
        <>
        <div className="pm-mb">
          <div className="pm-f pm-nt-para">
            <label className="pm-cap" htmlFor="pm-nt-q">Para <span className="pm-req">*</span></label>
            <div className={'pm-nt-box' + (erro ? ' bad' : '')} onMouseDown={e => { if (e.target === e.currentTarget) { e.preventDefault(); busca.current?.focus(); } }}>
              {sel.map(s => (
                <span key={s.email} className={'pm-nt-chip' + (s.nome ? ' u' : '')} title={s.email}>
                  {s.nome || s.email}
                  <button type="button" aria-label={`Remover ${s.email}`} disabled={enviando} onClick={() => setSel(l => l.filter(x => x.email !== s.email))}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  </button>
                </span>
              ))}
              <input id="pm-nt-q" ref={busca} value={q} disabled={enviando} autoComplete="off" spellCheck={false}
                role="combobox" aria-expanded={!!opcoes} aria-controls="pm-nt-sug" aria-autocomplete="list"
                placeholder={sel.length ? 'Adicionar outro…' : 'Buscar usuário ou digitar e-mail'}
                onChange={e => { setQ(e.target.value); setAtivo(0); setErro(''); }} onKeyDown={teclar} onPaste={colar} />
              {carregando ? <span className="pm-nt-spin" role="status" aria-label="Carregando usuários" /> : null}
            </div>
            <span className="pm-hint">{sel.length ? `${sel.length} de ${MAX_DESTINATARIOS} destinatários` : 'Busque pelo nome, e-mail ou departamento, ou digite um e-mail e tecle Enter.'}</span>
            {termo ? (
              <div className="pm-nt-sug" id="pm-nt-sug" role="listbox">
                {sugestoes.map((u, i) => (
                  <button key={u.email} type="button" role="option" aria-selected={i === ativo} className={'pm-nt-opt' + (i === ativo ? ' on' : '')} style={{ animationDelay: `${i * 30}ms` }}
                    onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAtivo(i)} onClick={() => escolher(i)}>
                    <span className="pm-nt-av">{iniciais(u.nome)}</span>
                    <span className="pm-nt-who"><b className="pm-ell">{u.nome}</b><em className="pm-ell">{u.email}</em></span>
                    {u.departamento ? <span className="pm-nt-dep">{u.departamento}</span> : null}
                  </button>
                ))}
                {podeNovo ? (
                  <button type="button" role="option" aria-selected={ativo === sugestoes.length} className={'pm-nt-opt' + (ativo === sugestoes.length ? ' on' : '')}
                    onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAtivo(sugestoes.length)} onClick={() => escolher(sugestoes.length)}>
                    <span className="pm-nt-av n"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
                    <span className="pm-nt-who"><b className="pm-ell">Adicionar {digitado}</b></span>
                  </button>
                ) : null}
                {!opcoes && carregando ? [0, 1, 2].map(i => <div key={i} className="pm-nt-sk" aria-hidden="true"><i /><span><em /><em /></span></div>) : null}
                {!opcoes && !carregando ? <div className="pm-nt-vazio">Nenhum usuário encontrado. Digite o e-mail completo para adicionar.</div> : null}
              </div>
            ) : null}
          </div>

          <div className="pm-f">
            <span className="pm-cap">Assunto</span>
            <div className="pm-nt-ro">{assunto}</div>
          </div>

          {contrato ? (
            <label className={'pm-nt-anexo' + (grande ? ' off' : '')}>
              <input type="checkbox" checked={anexar} disabled={grande || enviando} onChange={e => setAnexar(e.target.checked)} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pdf"><path d="M7 3.5h7l4 4V20.5H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              <span className="pm-ell">Anexar contrato <em>· {contrato.nome} · {tamanho(contrato.tamanho)}{grande ? ' · acima de 8 MB, vai só a lista de documentos' : ''}</em></span>
            </label>
          ) : null}

          {erro ? (
            <div key={erroN} className="pm-err pm-nt-shake" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', marginTop: '1px' }} aria-hidden="true"><circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" /><path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              {erro}
            </div>
          ) : null}
        </div>
        <div className="pm-mf">
          <span key={sel.length} className="pm-hint pm-nt-cont">{sel.length ? (sel.length === 1 ? '1 destinatário' : `${sel.length} destinatários`) : 'Nenhum destinatário'}</span>
          <div className="r">
            <button type="button" className="pm-btn" onClick={fechar} disabled={enviando}>Cancelar</button>
            <button type="button" className={'pm-btn prim pm-nt-send' + (enviando ? ' loading' : '')} onClick={confirmar} disabled={enviando}>
              {enviando
                ? <span className="pm-nt-spin claro" aria-hidden="true" />
                : <svg className="aviao" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12l16-7-6 15-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>}
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
