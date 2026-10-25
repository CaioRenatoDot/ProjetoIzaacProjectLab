import { type StatusSenha } from '@filas/contracts';

/**
 * Arestas da máquina de estados da senha (docs/03 §5, P-01). Qualquer par fora daqui é
 * `409 TRANSICAO_INVALIDA`. ENCERRADO, AUSENTE e DESISTENCIA são finais.
 */
export const TRANSICOES: Record<StatusSenha, readonly StatusSenha[]> = {
  // Chamar (UC-09, RN-04) e desistência (UC-17).
  AGUARDANDO: ['CHAMADA', 'DESISTENCIA'],
  // Retorno por tolerância (RN-12), ausência (UC-16), sem sala compatível (UC-10) e iniciar (UC-11).
  CHAMADA: ['AGUARDANDO', 'AUSENTE', 'AGUARDANDO_RECURSO', 'EM_ATENDIMENTO'],
  // Alocado quando o recurso libera, e então iniciado (UC-10, UC-11).
  AGUARDANDO_RECURSO: ['EM_ATENDIMENTO'],
  // Pausar (UC-12), encerrar com ou sem validação (UC-13, RN-11) e desistência (UC-17).
  EM_ATENDIMENTO: ['PAUSADO', 'PENDENTE_VALIDACAO', 'ENCERRADO', 'DESISTENCIA'],
  // Retomar (UC-12).
  PAUSADO: ['EM_ATENDIMENTO'],
  // Supervisor valida (RN-11); a recusa mantém o status, com parecer.
  PENDENTE_VALIDACAO: ['ENCERRADO'],
  ENCERRADO: [],
  AUSENTE: [],
  DESISTENCIA: [],
};

export function transicaoPermitida(de: StatusSenha, para: StatusSenha): boolean {
  return TRANSICOES[de].includes(para);
}

export interface HorariosSenha {
  chamadaEm?: Date | null;
  toleranciaAte?: Date | null;
  iniciadaEm?: Date;
  encerradaEm?: Date;
}

/**
 * Horários que a transição grava na senha. O retorno à fila por tolerância mantém a
 * `chegada_em` original: o paciente volta para a posição que tinha pela RN-04.
 */
export function horariosDaTransicao(
  de: StatusSenha,
  para: StatusSenha,
  agora: Date,
  toleranciaMinutos: number,
): HorariosSenha {
  switch (para) {
    case 'CHAMADA':
      return {
        chamadaEm: agora,
        toleranciaAte: new Date(agora.getTime() + toleranciaMinutos * 60_000),
      };
    case 'AGUARDANDO':
      return { chamadaEm: null, toleranciaAte: null };
    case 'AGUARDANDO_RECURSO':
      return { toleranciaAte: null };
    case 'EM_ATENDIMENTO':
      // Retomar a pausa não reinicia o atendimento.
      return de === 'PAUSADO' ? {} : { iniciadaEm: agora, toleranciaAte: null };
    case 'ENCERRADO':
    case 'AUSENTE':
    case 'DESISTENCIA':
      return { encerradaEm: agora, toleranciaAte: null };
    default:
      return {};
  }
}
