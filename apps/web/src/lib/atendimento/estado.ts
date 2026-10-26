import { type Desfecho, type Permissao, type StatusSenha } from '@filas/contracts';

export type AcaoAtendimento = 'iniciar' | 'pausar' | 'retomar' | 'encerrar' | 'validar';

/** Barra de ações por estado (T-13). "Alocado" é a senha chamada ou aguardando recurso. */
const ACOES: Partial<Record<StatusSenha, AcaoAtendimento[]>> = {
  CHAMADA: ['iniciar'],
  AGUARDANDO_RECURSO: ['iniciar'],
  EM_ATENDIMENTO: ['pausar', 'encerrar'],
  PAUSADO: ['retomar'],
  PENDENTE_VALIDACAO: ['validar'],
};

export const PERMISSAO_ACAO: Record<AcaoAtendimento, Permissao> = {
  iniciar: 'atendimento:criar',
  pausar: 'atendimento:editar',
  retomar: 'atendimento:editar',
  encerrar: 'atendimento:editar',
  validar: 'atendimento:validar',
};

/** Ações do estado que a pessoa pode fazer: sem permissão, a ação não aparece (`docs/01` §4.1). */
export function acoesDoEstado(
  status: StatusSenha,
  tem: (permissao: Permissao) => boolean,
): AcaoAtendimento[] {
  return (ACOES[status] ?? []).filter((acao) => tem(PERMISSAO_ACAO[acao]));
}

export const ROTULO_DESFECHO: Record<Desfecho, string> = {
  ALTA: 'Alta',
  RETORNO_AGENDADO: 'Retorno agendado',
  ENCAMINHAMENTO_INTERNO: 'Encaminhamento interno',
  ENCAMINHAMENTO_EXTERNO: 'Encaminhamento externo',
};

/** Duração em texto, não só em cor (T-13): "12 min", "1 h 05 min". */
export function duracaoTexto(minutos: number) {
  const total = Math.max(0, Math.floor(minutos));
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  return `${horas} h ${String(total % 60).padStart(2, '0')} min`;
}

/**
 * Duração exibida: a da API (já sem as pausas, RF-10) mais o tempo desde a leitura, só enquanto
 * o atendimento corre. Pausado, pendente ou encerrado, fica parada no valor da API.
 */
export function duracaoAgora(
  atendimento: { status: StatusSenha; duracaoMinutos: number },
  lidoEm: number,
  agora: number,
) {
  if (atendimento.status !== 'EM_ATENDIMENTO') return atendimento.duracaoMinutos;
  return atendimento.duracaoMinutos + Math.max(0, Math.floor((agora - lidoEm) / 60_000));
}
