// Chamado de conferência do título no TomTicket (edge function app-tomticket), aberto no nome
// do usuário logado a partir das telas Notas Fiscais › Cadastros e › Título a Pagar. Sem
// Supabase (modo demonstração) responde com dados de exemplo.
import { supabase } from './supabase';
import { invoke } from './api';

/** Tela que abre o chamado: define a permissão exigida pela edge function. */
export type OrigemChamado = 'cadastros' | 'titulos';

export interface OpcaoTomticket { id: string; nome: string }

export interface ChamadoPreparado {
  email: string;
  /** null: o TomTicket não confirmou nem negou o cadastro do cliente. */
  clienteEncontrado: boolean | null;
  departamento: OpcaoTomticket;
  categorias: OpcaoTomticket[];
  categoriaPadraoId: string | null;
  assunto: string;
  mensagem: string;
}

export interface ChamadoCriado { ok: true; mensagem: string; protocolo: string | null }

const fn = <T>(acao: string, corpo: Record<string, unknown>) => invoke<T>('app-tomticket', { acao, ...corpo });
const espera = <T>(valor: T) => new Promise<T>(res => setTimeout(() => res(valor), 600));

export const tomticketApi = {
  preparar: (billId: number, origem: OrigemChamado) => supabase ? fn<ChamadoPreparado>('preparar', { billId, origem }) : espera<ChamadoPreparado>({
    email: 'camila.ribeiro@horizonte.com.br',
    clienteEncontrado: true,
    departamento: { id: '1', nome: 'CONTABILIDADE' },
    categorias: [
      { id: '10', nome: 'ACOMPANHAMENTO DE EMPREITEIRO - CONTABILIDADE' },
      { id: '11', nome: 'APROVAÇÃO DE FORNECEDOR' },
      { id: '12', nome: 'CONFERÊNCIA DE TÍTULOS - FORA DA PROGRAMAÇÃO' },
      { id: '13', nome: 'CONFERÊNCIA DE TÍTULOS - PROGRAMAÇÃO FUTURA' },
      { id: '14', nome: 'CONFERÊNCIA DE TÍTULOS - PROGRAMAÇÃO VIGENTE' },
      { id: '15', nome: 'SOLICITAÇÃO DE DOCUMENTOS' },
    ],
    categoriaPadraoId: '14',
    assunto: 'Conferência de Títulos a Pagar',
    mensagem: `Por gentileza, conferir o título ${billId}.`,
  }),
  criar: (billId: number, categoriaId: string, mensagem: string, origem: OrigemChamado) =>
    supabase ? fn<ChamadoCriado>('criar', { billId, categoriaId, mensagem, origem }) : espera<ChamadoCriado>({ ok: true, mensagem: 'Chamado aberto.', protocolo: null }),
};
