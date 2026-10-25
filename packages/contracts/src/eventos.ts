import { type Prioridade } from './enums';
import { type SenhaResumo } from './senhas';

/**
 * Eventos de domínio do namespace `/filas` (docs/04 §7), emitidos pelo serviço depois do commit.
 * O gateway Socket.IO (parte 6.3) repassa para a sala `especialidade:{id}`.
 */
export interface EventosFila {
  'senha.criada': SenhaResumo;
  'senha.reclassificada': { senhaId: string; prioridade: Prioridade; novaPosicao: number | null };
}
export type NomeEventoFila = keyof EventosFila;
