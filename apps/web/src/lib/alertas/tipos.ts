/** Tipos conforme `docs/api/openapi.yaml` (tag "Alertas de SLA"). */

export type StatusAlerta = 'ATIVO' | 'RECONHECIDO' | 'NORMALIZADO';

/** `FILA_BLOQUEADA` é o bloqueio por ausência de supervisor (RN-10, P-04). */
export type TipoAlerta = 'SLA_EXCEDIDO' | 'FILA_BLOQUEADA';

export type AcaoEscalonamento = 'REFORCO_ATENDENTE' | 'VAGA_EXTRA';

export interface Escalonamento {
  id: string;
  alertaId: string;
  acao: AcaoEscalonamento;
  observacao: string | null;
  acionadoPor: string;
  acionadoEm: string;
}

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  status: StatusAlerta;
  filaId: string;
  especialidade: string;
  tempoEsperaMinutos: number | null;
  limiteMinutos: number | null;
  senhasAfetadas: number;
  disparadoEm: string;
  reconhecidoPor: string | null;
  reconhecidoEm: string | null;
  normalizadoEm: string | null;
  /** Fora do contrato (proposta, `docs/07`): medidas acionadas, com autor e horário (T-17). */
  escalonamentos?: Escalonamento[];
}
