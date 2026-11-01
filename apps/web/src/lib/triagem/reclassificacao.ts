import { type Prioridade, type StatusSenha } from '@filas/contracts';

/** Só senha ainda não atendida pode ser reclassificada (T-08, `TRANSICAO_INVALIDA` no servidor). */
export function podeReclassificar(status: StatusSenha) {
  return status === 'AGUARDANDO' || status === 'AGUARDANDO_RECURSO';
}

/** A nova prioridade precisa ser diferente da atual. */
export function prioridadesDisponiveis(
  todas: readonly Prioridade[],
  atual: Prioridade,
): Prioridade[] {
  return todas.filter((p) => p !== atual);
}
