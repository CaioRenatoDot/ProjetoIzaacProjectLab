import { type Prioridade, type StatusSenha } from './enums';
import { type SenhaResumo } from './senhas';

/**
 * Eventos de domínio do namespace `/filas` (docs/04 §7), emitidos pelo serviço depois do commit.
 * O gateway Socket.IO (parte 6.3) repassa para a sala `especialidade:{id}`.
 */
export interface EventosFila {
  'senha.criada': SenhaResumo;
  'senha.reclassificada': { senhaId: string; prioridade: Prioridade; novaPosicao: number | null };
  /** Toda transição da máquina de estados (P-01, docs/03 §5). */
  'senha.status_alterado': {
    senhaId: string;
    filaId: string;
    statusAnterior: StatusSenha;
    status: StatusSenha;
    versao: number;
  };
}
export type NomeEventoFila = keyof EventosFila;
