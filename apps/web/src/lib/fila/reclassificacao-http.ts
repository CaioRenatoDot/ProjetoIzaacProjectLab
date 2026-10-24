import { type Prioridade } from '@filas/contracts';

import { type ClienteHttp, ErroApi } from '@/lib/api/cliente-http';
import {
  type CodigoErroTriagem,
  ErroTriagem,
  type Reclassificacao,
  type TriagemApi,
} from '@/lib/triagem/tipos';

import { type SenhaResumo } from './tipos';

/** O que o modal de reclassificação usa da `TriagemApi`. */
export type ReclassificacaoApi = Pick<
  TriagemApi,
  'historicoReclassificacoes' | 'consultarSenha' | 'reclassificar' | 'parametros'
>;

const CODIGOS: readonly CodigoErroTriagem[] = [
  'VERSAO_DESATUALIZADA',
  'TRANSICAO_INVALIDA',
  'JUSTIFICATIVA_OBRIGATORIA',
  'VALIDACAO',
];

async function comErroTriagem<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroApi && (CODIGOS as string[]).includes(erro.codigo)) {
      throw new ErroTriagem(erro.codigo as CodigoErroTriagem, erro.detail);
    }
    throw erro;
  }
}

/**
 * Reclassificação pela API (UC-07), para o modal da 5.4 abrir no painel da fila.
 * `PATCH /senhas/{id}/prioridade` devolve `{ senha, novaPosicao }` (lacuna 5 da triagem, `docs/07`).
 */
export function criarReclassificacaoHttp(cliente: ClienteHttp): ReclassificacaoApi {
  return {
    historicoReclassificacoes: (senhaId) =>
      cliente.requisitar<Reclassificacao[]>(
        `/senhas/${encodeURIComponent(senhaId)}/reclassificacoes`,
      ),

    async consultarSenha(senhaId) {
      const senha = await cliente.requisitar<SenhaResumo>(`/senhas/${encodeURIComponent(senhaId)}`);
      return { prioridade: senha.prioridade, versao: senha.versao, posicao: senha.posicao ?? 0 };
    },

    async reclassificar({ senhaId, prioridade, justificativa, versao }) {
      const resposta = await comErroTriagem(
        cliente.requisitar<{
          senha: { prioridade: Prioridade; versao: number };
          novaPosicao: number;
        }>(`/senhas/${encodeURIComponent(senhaId)}/prioridade`, {
          metodo: 'PATCH',
          corpo: { prioridade, justificativa, versao },
        }),
      );
      return {
        prioridade: resposta.senha.prioridade,
        versao: resposta.senha.versao,
        novaPosicao: resposta.novaPosicao,
      };
    },

    /** Sem endpoint no contrato (lacuna 1 da triagem, `docs/07`): `GET /parametros` é proposta. */
    parametros: () => cliente.requisitar<{ justificativaMinCaracteres: number }>('/parametros'),
  };
}
