import { type Prioridade } from '@filas/contracts';

import { type ClienteHttp } from '@/lib/api/cliente-http';
import { type Pagina } from '@/lib/cadastros/tipos';
import { type Fila, type SenhaResumo } from '@/lib/fila/tipos';

/**
 * Tipos conforme `docs/api/openapi.yaml` (tag "Encaminhamento"). Ficam aqui até o schema entrar
 * em `@filas/contracts` com a API da #26.
 */
export interface EncaminhamentoInternoEntrada {
  tipo: 'INTERNO';
  especialidadeDestinoId: string;
  motivo?: string;
  prioridadeSugerida?: Prioridade;
}

export interface EncaminhamentoExternoEntrada {
  tipo: 'EXTERNO';
  instituicaoDestino: string;
  motivo: string;
  observacoes?: string;
}

export type EncaminhamentoEntrada = EncaminhamentoInternoEntrada | EncaminhamentoExternoEntrada;

export interface Encaminhamento {
  id: string;
  atendimentoOrigemId: string;
  tipo: 'INTERNO' | 'EXTERNO';
  especialidadeDestino: string | null;
  instituicaoDestino: string | null;
  motivo: string;
  /** Só no interno: a nova senha, já na fila de destino (RF-08). */
  senhaGerada: SenhaResumo | null;
  avisos: { codigo: string; mensagem: string }[];
  criadoEm: string;
}

export function criarEncaminhamentoApi(cliente: ClienteHttp) {
  return {
    /**
     * Destinos do interno: as filas ativas, uma por especialidade. Trazem o bloqueio por falta de
     * supervisor (RN-10) e exigem só `fila:consultar`, que o perfil Estudante tem.
     */
    destinos: () => cliente.requisitar<Pagina<Fila>>('/filas?ativa=true&pagina=1&tamanho=100'),

    registrar: (atendimentoId: string, entrada: EncaminhamentoEntrada) =>
      cliente.requisitar<Encaminhamento>(
        `/atendimentos/${encodeURIComponent(atendimentoId)}/encaminhamentos`,
        { metodo: 'POST', corpo: entrada },
      ),
  };
}

export type EncaminhamentoApi = ReturnType<typeof criarEncaminhamentoApi>;
