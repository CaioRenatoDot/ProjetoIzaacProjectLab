export interface ChamadaPublica {
  numero: string;
  especialidade: string;
  local: string;
  sequencia: number;
}
export interface EstadoPainel {
  atual: ChamadaPublica | null;
  anteriores: ChamadaPublica[];
}
export const STATUS_PUBLICOS = [
  'AGUARDANDO',
  'CHAMADA',
  'AGUARDANDO_RECURSO',
  'EM_ATENDIMENTO',
  'PAUSADO',
  'PENDENTE_VALIDACAO',
  'ENCERRADO',
  'AUSENTE',
  'DESISTENCIA',
] as const;
export type StatusPublico = (typeof STATUS_PUBLICOS)[number];
export interface ConsultaPublica {
  numero: string;
  especialidade: string;
  status: StatusPublico;
  posicao: number | null;
  tempoEstimadoMinutos: number | null;
  local: string | null;
}
export interface EventosPainel {
  chamada: (chamada: ChamadaPublica) => void;
  estado: (estado: EstadoPainel) => void;
  conexao: (conectado: boolean) => void;
}
export interface FontePublica {
  estado: (signal?: AbortSignal) => Promise<EstadoPainel>;
  consultar: (numero: string, signal?: AbortSignal) => Promise<ConsultaPublica>;
  conectar: (eventos: EventosPainel) => () => void;
}
export class ErroPublico extends Error {
  constructor(
    readonly status: number,
    readonly esperaSegundos = 30,
  ) {
    super(
      status === 404
        ? 'Não localizamos essa senha para o dia de hoje. Procure a recepção.'
        : status === 429
          ? 'Aguarde um pouco antes de consultar novamente.'
          : 'Não foi possível atualizar agora. Tente novamente em instantes.',
    );
  }
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new ErroPublico(502);
  return valor as Record<string, unknown>;
}
function texto(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroPublico(502);
  return valor;
}
function inteiroOpcional(valor: unknown): number | null {
  if (valor === null) return null;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0)
    throw new ErroPublico(502);
  return valor;
}

/** Reconstrói a projeção pública. Nenhuma propriedade extra atravessa esta fronteira. */
export function projetarChamada(valor: unknown): ChamadaPublica {
  const dado = objeto(valor);
  const sequencia = dado.sequencia === undefined ? 0 : inteiroOpcional(dado.sequencia);
  if (sequencia === null) throw new ErroPublico(502);
  return {
    numero: texto(dado.numero),
    especialidade: texto(dado.especialidade),
    local: texto(dado.local),
    sequencia,
  };
}
export function projetarEstado(valor: unknown): EstadoPainel {
  const dado = objeto(valor);
  if (!Array.isArray(dado.anteriores)) throw new ErroPublico(502);
  return {
    atual: dado.atual === null ? null : projetarChamada(dado.atual),
    anteriores: dado.anteriores.slice(0, 4).map(projetarChamada),
  };
}
export function projetarConsulta(valor: unknown): ConsultaPublica {
  const dado = objeto(valor);
  if (!STATUS_PUBLICOS.some((s) => s === dado.status)) throw new ErroPublico(502);
  return {
    numero: texto(dado.numero),
    especialidade: texto(dado.especialidade),
    status: dado.status as StatusPublico,
    posicao: inteiroOpcional(dado.posicao),
    tempoEstimadoMinutos: inteiroOpcional(dado.tempoEstimadoMinutos),
    local: dado.local === null ? null : texto(dado.local),
  };
}

/** Ordenação de apresentação; prioridade e política da fila permanecem no servidor. */
export function aplicarChamada(estado: EstadoPainel, chamada: ChamadaPublica): EstadoPainel {
  const mesma =
    estado.atual?.numero === chamada.numero && estado.atual.especialidade === chamada.especialidade;
  if (mesma && chamada.sequencia <= estado.atual!.sequencia) return estado;
  const anteriores = mesma
    ? estado.anteriores
    : [...(estado.atual ? [estado.atual] : []), ...estado.anteriores].filter(
        (item) => item.numero !== chamada.numero || item.especialidade !== chamada.especialidade,
      );
  return { atual: chamada, anteriores: anteriores.slice(0, 4) };
}

export const ROTULOS_STATUS: Record<StatusPublico, string> = {
  AGUARDANDO: 'Aguardando',
  CHAMADA: 'Chamada',
  AGUARDANDO_RECURSO: 'Aguardando recurso',
  EM_ATENDIMENTO: 'Em atendimento',
  PAUSADO: 'Pausado',
  PENDENTE_VALIDACAO: 'Pendente de validação',
  ENCERRADO: 'Encerrado',
  AUSENTE: 'Ausente',
  DESISTENCIA: 'Desistência',
};
export function orientacaoConsulta(senha: ConsultaPublica) {
  if (senha.status === 'AUSENTE' || senha.status === 'DESISTENCIA')
    return 'Procure a recepção para orientação.';
  if (senha.status === 'CHAMADA')
    return senha.local
      ? `Dirija-se a ${senha.local}.`
      : 'Sua senha foi chamada. Procure a recepção para orientação.';
  if (senha.status === 'ENCERRADO') return 'Atendimento encerrado.';
  if (senha.status === 'AGUARDANDO') return 'Aguarde ser chamado no painel da sala de espera.';
  return 'Aguarde a orientação da equipe de atendimento.';
}
