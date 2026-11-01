import {
  type AtendimentoDetalhe,
  type AtendimentoResumo,
  type Desfecho,
  type EncerramentoResposta,
  type StatusSenha,
} from '@filas/contracts';

import { type ClienteHttp } from '@/lib/api/cliente-http';
import { type Pagina } from '@/lib/cadastros/tipos';
import { type SenhaResumo } from '@/lib/fila/tipos';

export interface FiltroAtendimentos {
  status?: StatusSenha[];
  pagina?: number;
  tamanho?: number;
}

/** Status em que a senha já tem atendimento (o início cria a linha, RF-07). */
export const COM_ATENDIMENTO: readonly StatusSenha[] = [
  'EM_ATENDIMENTO',
  'PAUSADO',
  'PENDENTE_VALIDACAO',
  'ENCERRADO',
];

function consulta(filtro: FiltroAtendimentos & { senhaId?: string }) {
  const params = new URLSearchParams();
  params.set('pagina', String(filtro.pagina ?? 1));
  params.set('tamanho', String(filtro.tamanho ?? 20));
  if (filtro.status?.length) params.set('status', filtro.status.join(','));
  if (filtro.senhaId) params.set('senhaId', filtro.senhaId);
  return params.toString();
}

export function criarAtendimentoApi(cliente: ClienteHttp) {
  const atendimento = (id: string) => `/atendimentos/${encodeURIComponent(id)}`;
  return {
    senha: (id: string) => cliente.requisitar<SenhaResumo>(`/senhas/${encodeURIComponent(id)}`),

    listar: (filtro: FiltroAtendimentos) =>
      cliente.requisitar<Pagina<AtendimentoResumo>>(`/atendimentos?${consulta(filtro)}`),

    /**
     * Atendimento de uma senha (um por senha). O contrato não filtra por senha: busca pelo status
     * atual dela e escolhe pelo `senhaId`. O parâmetro `senhaId` é proposta (`docs/07`); a API
     * real o ignora, e o filtro no cliente garante o resultado.
     */
    daSenha: async (senha: Pick<SenhaResumo, 'id' | 'status'>) => {
      const pagina = await cliente.requisitar<Pagina<AtendimentoResumo>>(
        `/atendimentos?${consulta({ status: [senha.status], tamanho: 100, senhaId: senha.id })}`,
      );
      return pagina.dados.find((a) => a.senhaId === senha.id) ?? null;
    },

    /** Sensível: inclui a triagem e grava CONSULTAR_SENSIVEL na auditoria (RNF-07). */
    detalhe: (id: string) => cliente.requisitar<AtendimentoDetalhe>(atendimento(id)),

    iniciar: (senhaId: string, versao: number) =>
      cliente.requisitar<AtendimentoResumo>(`/senhas/${encodeURIComponent(senhaId)}/atendimento`, {
        metodo: 'POST',
        corpo: { versao },
      }),

    pausar: (id: string, entrada: { motivo?: string; versao: number }) =>
      cliente.requisitar<AtendimentoResumo>(`${atendimento(id)}/pausa`, {
        metodo: 'POST',
        corpo: entrada,
      }),

    retomar: (id: string, versao: number) =>
      cliente.requisitar<AtendimentoResumo>(`${atendimento(id)}/retomada`, {
        metodo: 'POST',
        corpo: { versao },
      }),

    encerrar: (
      id: string,
      entrada: { desfecho: Desfecho | null; observacoes?: string; versao: number },
    ) =>
      cliente.requisitar<EncerramentoResposta>(`${atendimento(id)}/encerramento`, {
        metodo: 'POST',
        corpo: entrada,
      }),

    validar: (id: string, entrada: { aprovado: boolean; parecer?: string; versao: number }) =>
      cliente.requisitar<AtendimentoResumo>(`${atendimento(id)}/validacao`, {
        metodo: 'POST',
        corpo: entrada,
      }),
  };
}

export type AtendimentoApi = ReturnType<typeof criarAtendimentoApi>;
