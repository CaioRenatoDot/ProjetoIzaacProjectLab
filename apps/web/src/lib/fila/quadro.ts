import { type Prioridade, type StatusSenha, type TipoAtendimento } from '@filas/contracts';

import { type SenhaResumo } from './tipos';

/** Colunas do quadro (T-09), na ordem da tela. */
export interface ColunaQuadro {
  id: string;
  rotulo: string;
  /** Status que entram na coluna. "Aguardando recurso" acompanha a coluna "Chamada" (UC-10). */
  status: readonly StatusSenha[];
  /** Estado vazio por coluna (T-09: "Nenhuma senha aguardando"). */
  vazio: string;
}

export const COLUNAS_QUADRO: readonly ColunaQuadro[] = [
  {
    id: 'aguardando',
    rotulo: 'Aguardando',
    status: ['AGUARDANDO'],
    vazio: 'Nenhuma senha aguardando',
  },
  {
    id: 'chamada',
    rotulo: 'Chamada',
    status: ['CHAMADA', 'AGUARDANDO_RECURSO'],
    vazio: 'Nenhuma senha chamada',
  },
  {
    id: 'em-atendimento',
    rotulo: 'Em atendimento',
    status: ['EM_ATENDIMENTO'],
    vazio: 'Nenhuma senha em atendimento',
  },
  { id: 'pausado', rotulo: 'Pausado', status: ['PAUSADO'], vazio: 'Nenhuma senha pausada' },
  {
    id: 'pendente-validacao',
    rotulo: 'Pendente de validação',
    status: ['PENDENTE_VALIDACAO'],
    vazio: 'Nenhuma senha pendente de validação',
  },
];

/**
 * Distribui as senhas pelas colunas mantendo a ordem que vem da API: a ordenação da RN-04
 * (prioridade, chegada, agendamento prévio) é feita no servidor e não é refeita aqui.
 */
export function agruparPorColuna(senhas: readonly SenhaResumo[]) {
  return COLUNAS_QUADRO.map((coluna) => ({
    coluna,
    senhas: senhas.filter((s) => coluna.status.includes(s.status)),
  }));
}

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  NORMAL: 'Normal',
  PREFERENCIAL: 'Preferencial',
  URGENTE: 'Urgente',
};

export const ROTULO_TIPO_ATENDIMENTO: Record<TipoAtendimento, string> = {
  PRIMEIRA_CONSULTA: 'Primeira consulta',
  RETORNO: 'Retorno',
  ENCAIXE: 'Encaixe',
};

/** Minutos desde `inicio`, para o cronômetro do cartão (texto, não só cor: T-09). */
export function minutosDesde(inicio: string, agora: number) {
  return Math.max(0, Math.floor((agora - Date.parse(inicio)) / 60_000));
}

export function textoMinutos(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * A próxima chamada fura a fila por urgência (RN-03): a primeira aguardando é urgente e chegou
 * depois de alguma senha não urgente. A tela pede confirmação antes de chamar (T-09).
 */
export function proximaFuraFila(senhas: readonly SenhaResumo[]) {
  const aguardando = senhas.filter((s) => s.status === 'AGUARDANDO');
  const proxima = aguardando[0];
  if (!proxima || proxima.prioridade !== 'URGENTE') return null;
  const passaAFrente = aguardando.some(
    (s) => s.prioridade !== 'URGENTE' && Date.parse(s.chegadaEm) < Date.parse(proxima.chegadaEm),
  );
  return passaAFrente ? proxima : null;
}

/** Senhas que passaram a "Chamada" entre duas leituras, para o anúncio em `aria-live`. */
export function novasChamadas(anterior: readonly SenhaResumo[], atual: readonly SenhaResumo[]) {
  const jaChamadas = new Set(anterior.filter((s) => s.status === 'CHAMADA').map((s) => s.id));
  return atual.filter((s) => s.status === 'CHAMADA' && !jaChamadas.has(s.id));
}
