import { type Prioridade, type StatusSenha, type TipoAtendimento } from '@filas/contracts';

/** Tipos conforme `docs/api/openapi.yaml` (tag "Filas e chamadas"). */

export interface BloqueioFila {
  ativo: boolean;
  motivo: string | null;
  desde: string | null;
}

export interface Fila {
  id: string;
  nome: string;
  especialidadeId: string;
  especialidade: string;
  ativa: boolean;
  slaMinutos: number;
  toleranciaMinutos: number;
  /** Fonte única do banner de P-04 e do botão desabilitado (RN-10). */
  bloqueio: BloqueioFila;
}

/** Projeção de lista e cartão: sem conteúdo clínico (ADR-003). */
export interface SenhaResumo {
  id: string;
  numero: string;
  filaId: string;
  especialidade: string;
  pacienteIniciais: string;
  prioridade: Prioridade;
  tipoAtendimento: TipoAtendimento;
  status: StatusSenha;
  posicao: number | null;
  chegadaEm: string;
  chamadaEm: string | null;
  toleranciaAte: string | null;
  tempoEsperaMinutos: number;
  slaExcedido: boolean;
  temAgendamentoPrevio: boolean;
  versao: number;
  /**
   * Chamada vigente, para "Rechamar" (`POST /chamadas/{id}/rechamada`). Não está em `SenhaResumo`
   * no contrato: lacuna em `docs/07-pendencias-integracao.md`.
   */
  chamadaId?: string | null;
}

export interface MetricasFila {
  aguardando: number;
  chamadas: number;
  emAtendimento: number;
  ausenciasHoje: number;
  tempoMedioEsperaMinutos: number | null;
}

/** Resposta de `GET /filas/{id}/senhas`. */
export interface QuadroFila {
  fila: Fila;
  metricas: MetricasFila;
  dados: SenhaResumo[];
  meta: { pagina: number; tamanho: number; total: number; totalPaginas: number };
  sincronizadoEm: string;
}

export interface Chamada {
  id: string;
  senhaId: string;
  numero: string;
  local: string;
  sequencia: number;
  chamadoEm: string;
  chamadoPor: string;
}

/** Resposta de `POST /filas/{id}/chamadas`. */
export interface ResultadoChamada {
  senha: SenhaResumo;
  chamada: Chamada;
  furouFilaPorUrgencia: boolean;
  toleranciaAte: string;
}
