/** Tipos conforme `docs/api/openapi.yaml` (tag "Alocação"). */

export type MotivoInaptidao =
  | 'ATENDIMENTO_ATIVO'
  | 'ESPECIALIDADE_INCOMPATIVEL'
  | 'FORA_DO_TURNO'
  | 'LIMITE_SUPERVISAO_ATINGIDO'
  | 'RECURSO_INDISPONIVEL_NA_SALA';

export interface CandidatoAlocacao {
  id: string;
  nome: string;
  /** Linha de apoio: especialidade e nível, ocupação "2 de 3", equipamentos. */
  descricao: string;
  apto: boolean;
  motivoInaptidao: MotivoInaptidao | null;
  /** Exibido no próprio item, não em tooltip (T-10). */
  motivoTexto: string | null;
}

export interface BlocoAlocacao {
  sugestao: CandidatoAlocacao | null;
  alternativas: CandidatoAlocacao[];
  regrasVerificadas: string[];
}

export interface SugestoesAlocacao {
  senhaId: string;
  estudante: BlocoAlocacao;
  /** `aplicavel: false` quando a especialidade não exige supervisão (RN-07). */
  supervisor: BlocoAlocacao & { aplicavel: boolean };
  sala: BlocoAlocacao;
}

export interface AlocacaoEntrada {
  estudanteId: string;
  supervisorId: string | null;
  salaId: string;
  versao: number;
}

export interface Alocacao {
  id: string;
  senhaId: string;
  estudante: { id: string; nome: string };
  supervisor: { id: string; nome: string } | null;
  sala: { id: string; nome: string };
  confirmadaEm: string;
  confirmadaPor: string;
  liberadaEm: string | null;
}

export type RecursoFaltante = 'ESTUDANTE' | 'SUPERVISOR' | 'SALA';
