// Permutas › Terrenos: aba "Histórico" da modal do permutante. Lista (mais recente primeiro) o que mudou
// no cadastro e nas unidades: quem, quando, campos antes → depois e o motivo das inativações.
import { useEffect, useState } from 'react';
import { m2, nomeEmpreendimento, pct, type HistoricoItem, type Negocio, type UnidadeCatalogo } from '../../lib/permutas';
import type { EmpresaOpcao } from './PermutaModal';

const ROTULOS: Record<string, string> = {
  empresa_id: 'Negócio', negocio_id: 'Negócio (avulso)', permutante: 'Permutante', num_matricula: 'Nº da matrícula',
  data_contrato: 'Data do contrato', cidade: 'Cidade', area_matricula: 'Área de matrícula', coeficiente: 'Coeficiente',
  pct_permuta: '% permuta', area_propria: 'Próprio empreendimento', area_informada: 'Área de permuta informada',
  observacao: 'Observação', pendencia: 'Pendência', inscricao_iptu: 'Inscrição IPTU', inscricao_equatorial: 'Inscrição Equatorial',
  inscricao_saneago: 'Inscrição Saneago/BRK', cpf_cnpj: 'CPF/CNPJ', enterprise_id: 'Empreendimento', unidade_nome: 'Unidade',
  area_privativa: 'Área privativa', valor_unidade: 'Valor da unidade',
};
const TITULOS: Record<HistoricoItem['acao'], string> = {
  criado: 'Cadastro criado', editado: 'Cadastro editado', inativado: 'Cadastro inativado', reativado: 'Cadastro reativado',
  unidade_incluida: 'Unidade incluída', unidade_editada: 'Unidade alterada', unidade_removida: 'Unidade removida',
  unidade_inativada: 'Unidade inativada', unidade_reativada: 'Unidade reativada',
};
/** Cor do marcador na linha do tempo. */
const tom = (a: HistoricoItem['acao']) =>
  /inativad|removida/.test(a) ? 'err' : /reativad|criado|incluida/.test(a) ? 'ok' : 'info';
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function HistoricoPermuta({ permutaId, versao, carregar, empresas, negocios, catalogo }: {
  permutaId: string | null; versao: number; carregar: (id: string) => Promise<HistoricoItem[]>;
  empresas: EmpresaOpcao[]; negocios: Negocio[]; catalogo: UnidadeCatalogo[];
}) {
  const [itens, setItens] = useState<HistoricoItem[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!permutaId) return;
    let vivo = true;
    carregar(permutaId).then(l => { if (vivo) { setItens(l); setErro(''); } }).catch(e => { if (vivo) setErro(e?.message || String(e)); });
    return () => { vivo = false; };
  }, [permutaId, versao, carregar]);

  const nomeEmp = (id: number) => {
    const u = catalogo.find(x => x.enterprise_id === id);
    return u ? nomeEmpreendimento(u) : `Empreendimento ${id}`;
  };
  /** Valor do banco → texto legível, conforme o campo. */
  const valor = (campo: string, v: any): string => {
    if (v == null || v === '') return '—';
    switch (campo) {
      case 'empresa_id': return empresas.find(e => e.id === Number(v))?.nome || `Empresa ${v}`;
      case 'negocio_id': return negocios.find(n => n.id === v)?.nome || 'Negócio';
      case 'enterprise_id': return nomeEmp(Number(v));
      case 'pct_permuta': return pct(Number(v));
      case 'coeficiente': return String(Number(v)).replace('.', ',') + 'x';
      case 'area_matricula': case 'area_propria': case 'area_informada': case 'area_privativa': return m2(Number(v)) + ' m²';
      case 'valor_unidade': return brl.format(Number(v));
      case 'data_contrato': return String(v).slice(0, 10).split('-').reverse().join('/');
      default: return String(v);
    }
  };

  if (!permutaId) {
    return <div className="pm-empty"><b>Sem histórico ainda.</b>As alterações aparecem aqui depois que o permutante for salvo.</div>;
  }
  if (erro) return <div className="pm-err">Não foi possível carregar o histórico: {erro}</div>;
  if (!itens) return <div className="pm-empty">Carregando histórico…</div>;
  if (!itens.length) return <div className="pm-empty"><b>Nenhuma alteração registrada.</b>O histórico começa a contar a partir desta versão do sistema.</div>;

  return (
    <ol className="pm-hist">
      {itens.map(h => {
        const campos = Object.entries(h.alteracoes || {});
        return (
          <li key={h.id} className="pm-hist-i">
            <span className={'pm-hist-dot ' + tom(h.acao)} />
            <div className="pm-hist-c">
              <div className="pm-hist-t">
                <b>{TITULOS[h.acao] || h.acao}</b>
                {h.unidade ? <span className="pm-hist-u">{h.enterprise_id != null ? `${nomeEmp(h.enterprise_id)} · ` : ''}{h.unidade}</span> : null}
              </div>
              <div className="pm-meta">{h.usuario || 'Usuário não identificado'} · {quando(h.criado_em)}</div>
              {campos.length ? (
                <ul className="pm-hist-alt">
                  {campos.map(([k, d]) => (
                    <li key={k}>
                      <span className="k">{ROTULOS[k] || k}</span>
                      <span className="de">{valor(k, d.de)}</span>
                      <span className="seta">→</span>
                      <span className="para">{valor(k, d.para)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {h.motivo ? <div className="pm-hist-mot"><span className="pm-cap">Motivo</span>{h.motivo}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
