import { type Prioridade, type StatusSenha } from './enums';
import { type RestricaoAplicada } from './ausencias';
import { type Chamada } from './filas';
import { type SenhaResumo } from './senhas';

/**
 * Eventos de domínio do namespace `/filas` (docs/04 §7), emitidos pelo serviço depois do commit.
 * O gateway Socket.IO (parte 6.3) repassa para a sala `especialidade:{id}`.
 */
export interface EventosFila {
  'senha.criada': SenhaResumo;
  /** Chamada e rechamada (UC-09, T-11); o telão repete o destaque a cada uma. */
  'senha.chamada': { senha: SenhaResumo; chamada: Chamada };
  'senha.reclassificada': { senhaId: string; prioridade: Prioridade; novaPosicao: number | null };
  /** Ausência manual ou automática (RN-12), com a restrição aplicada (RN-13), para W-15. */
  'ausencia.registrada': {
    senha: SenhaResumo;
    automatica: boolean;
    restricaoAplicada: RestricaoAplicada | null;
  };
  /** RN-10: fila sem supervisor habilitado disponível. O desbloqueio é da parte 6.3. */
  'fila.bloqueada': { filaId: string; especialidade: string; motivo: string; desde: string };
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
