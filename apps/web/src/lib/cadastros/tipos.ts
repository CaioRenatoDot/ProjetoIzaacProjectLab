import { type VinculoPaciente } from '@filas/contracts';

/** Tipos conforme `docs/api/openapi.yaml` (tag "Cadastros base"). */

export type Turno = 'MANHA' | 'TARDE' | 'NOITE';

export interface ItemReferencia {
  id: string;
  nome: string;
}

export interface Disponibilidade {
  diaSemana: number;
  turno: Turno;
}

export interface Paciente {
  id: string;
  nomeCompleto: string;
  iniciais: string;
  documento: string;
  dataNascimento: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  vinculo: VinculoPaciente;
  restricaoAtiva: boolean;
  restricaoAte: string | null;
  ativo: boolean;
}

export interface Estudante {
  id: string;
  nome: string;
  especialidadeId: string;
  especialidade: string;
  nivelFormacao: string;
  habilitacoes: ItemReferencia[];
  procedimentosAutorizados: ItemReferencia[];
  disponibilidade: Disponibilidade[];
  ocupado: boolean;
  ativo: boolean;
}

export interface Supervisor {
  id: string;
  nome: string;
  especialidades: ItemReferencia[];
  procedimentos: ItemReferencia[];
  disponibilidade: Disponibilidade[];
  limiteEstudantesSimultaneos: number;
  ocupacaoAtual: number;
  ativo: boolean;
}

export interface Sala {
  id: string;
  identificacao: string;
  caracteristicas: string;
  recursos: ItemReferencia[];
  situacao: string;
  ocupada: boolean;
  ativo: boolean;
}

export interface Especialidade {
  id: string;
  nome: string;
  descricao: string;
  exigeSupervisaoDocente: boolean;
  exigeValidacaoEncerramento: boolean;
  toleranciaMinutos: number;
  recursosExigidos: ItemReferencia[];
  filasVinculadas: number;
  ativa: boolean;
}

/** Resposta paginada (`docs/04-contrato-api.md` §5). */
export interface Pagina<T> {
  dados: T[];
  meta: { pagina: number; tamanho: number; total: number; totalPaginas: number };
}
