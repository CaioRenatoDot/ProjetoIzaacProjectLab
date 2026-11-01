import { type StatusSenha } from '@filas/contracts';

import { type ClienteHttp } from '@/lib/api/cliente-http';

export interface SenhaOcorrencia {
  id: string;
  numero: string;
  status: StatusSenha;
  versao: number;
  toleranciaAte: string | null;
}

export interface RegistroDesistencia {
  senha: SenhaOcorrencia;
  recursosLiberados: boolean;
}

export interface RegistroAusencia extends RegistroDesistencia {
  automatica: boolean;
  restricaoAplicada: {
    tipo: 'RESTRICAO_TEMPORARIA' | 'CONFIRMACAO_PREVIA';
    ate: string | null;
    descricao: string;
  } | null;
}

export interface AusenciaEntrada {
  versao: number;
  observacao?: string;
  confirmadoAntesDaTolerancia: boolean;
}

export interface DesistenciaEntrada {
  versao: number;
  origem: 'PACIENTE' | 'EQUIPE';
  motivo?: string;
}

/** Projeções locais do OpenAPI; não altera os schemas compartilhados (AGENTS.md §6). */
export function criarAusenciasApi(cliente: ClienteHttp) {
  return {
    registrarAusencia: (id: string, corpo: AusenciaEntrada) =>
      cliente.requisitar<RegistroAusencia>(`/senhas/${encodeURIComponent(id)}/ausencia`, {
        metodo: 'POST',
        corpo,
      }),
    registrarDesistencia: (id: string, corpo: DesistenciaEntrada) =>
      cliente.requisitar<RegistroDesistencia>(`/senhas/${encodeURIComponent(id)}/desistencia`, {
        metodo: 'POST',
        corpo,
      }),
  };
}

export type AusenciasApi = ReturnType<typeof criarAusenciasApi>;
