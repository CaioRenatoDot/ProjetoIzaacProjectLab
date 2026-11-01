import { type AcaoEscalonamento, type Alerta, type TipoAlerta } from './tipos';

export const ROTULO_TIPO: Record<TipoAlerta, string> = {
  SLA_EXCEDIDO: 'Espera acima do limite',
  FILA_BLOQUEADA: 'Fila bloqueada',
};

export const ROTULO_ACAO: Record<AcaoEscalonamento, string> = {
  REFORCO_ATENDENTE: 'Reforço de atendentes',
  VAGA_EXTRA: 'Vaga extra',
};

/** Rótulo do botão que aciona cada medida (T-17). */
export const ROTULO_BOTAO_ACAO: Record<AcaoEscalonamento, string> = {
  REFORCO_ATENDENTE: 'Reforçar atendentes',
  VAGA_EXTRA: 'Abrir vaga extra',
};

const minutos = (n: number) => (n === 1 ? '1 min' : `${n} min`);

/**
 * Gravidade em texto, além da cor (T-17). O contrato não tem nível de gravidade: a tela descreve
 * o quanto a espera passou do limite e mantém a ordem da API, sem classificar por conta própria.
 */
export function descreverGravidade(alerta: Alerta): string {
  if (alerta.tipo === 'FILA_BLOQUEADA') {
    return 'Chamadas suspensas por ausência de supervisor (RN-10)';
  }
  const { tempoEsperaMinutos: espera, limiteMinutos: limite } = alerta;
  if (espera === null || limite === null) return 'Espera acima do limite definido';
  const excesso = Math.max(0, espera - limite);
  return `Espera de ${minutos(espera)}, ${minutos(excesso)} acima do limite de ${minutos(limite)}`;
}

/** Reconhecido sai do topo sem desaparecer (T-17): ativos primeiro, cada grupo na ordem da API. */
export function ordenarParaExibicao(alertas: readonly Alerta[]): Alerta[] {
  return [
    ...alertas.filter((a) => a.status === 'ATIVO'),
    ...alertas.filter((a) => a.status === 'RECONHECIDO'),
  ];
}

export interface Mudancas {
  novos: Alerta[];
  normalizados: Alerta[];
}

/**
 * Compara duas leituras da lista de alertas em aberto. Vale para a revalidação periódica e para
 * o evento de tempo real, que só precisa invalidar a consulta (`docs/04` §7).
 */
export function compararLeituras(anterior: readonly Alerta[], atual: readonly Alerta[]): Mudancas {
  const idsAnteriores = new Set(anterior.map((a) => a.id));
  const idsAtuais = new Set(atual.map((a) => a.id));
  return {
    novos: atual.filter((a) => !idsAnteriores.has(a.id)),
    normalizados: anterior.filter((a) => !idsAtuais.has(a.id)),
  };
}

export function anunciarMudancas({ novos, normalizados }: Mudancas): string {
  const frases = [
    ...novos.map(
      (a) => `Novo alerta: ${a.especialidade}, ${ROTULO_TIPO[a.tipo].toLocaleLowerCase('pt-BR')}.`,
    ),
    ...normalizados.map(
      (a) => `O alerta de ${a.especialidade} foi normalizado e passou para o histórico.`,
    ),
  ];
  return frases.join(' ');
}

const formatoHorario = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatarHorario = (iso: string) => formatoHorario.format(new Date(iso));
