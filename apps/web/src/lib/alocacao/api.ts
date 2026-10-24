import { type ClienteHttp } from '@/lib/api/cliente-http';
import { type SenhaResumo } from '@/lib/fila/tipos';

import {
  type Alocacao,
  type AlocacaoEntrada,
  type BlocoAlocacao,
  type CandidatoAlocacao,
  type RecursoFaltante,
  type SugestoesAlocacao,
} from './tipos';

export function criarAlocacaoApi(cliente: ClienteHttp) {
  const senha = (id: string) => `/senhas/${encodeURIComponent(id)}`;
  return {
    senha: (id: string) => cliente.requisitar<SenhaResumo>(senha(id)),

    sugestoes: (id: string) =>
      cliente.requisitar<SugestoesAlocacao>(`${senha(id)}/alocacao/sugestoes`),

    /** A mesma `chaveIdempotencia` em duplo clique ou reenvio não confirma duas vezes (`docs/04` §6). */
    confirmar: (id: string, entrada: AlocacaoEntrada, chaveIdempotencia: string) =>
      cliente.requisitar<Alocacao>(`${senha(id)}/alocacao`, {
        metodo: 'POST',
        corpo: entrada,
        cabecalhos: { 'Idempotency-Key': chaveIdempotencia },
      }),

    manterAguardando: (
      id: string,
      entrada: { recursoFaltante: RecursoFaltante; observacao?: string; versao: number },
    ) =>
      cliente.requisitar<SenhaResumo>(`${senha(id)}/aguardando-recurso`, {
        metodo: 'POST',
        corpo: entrada,
      }),
  };
}

export type AlocacaoApi = ReturnType<typeof criarAlocacaoApi>;

/** Sugestão primeiro, depois as alternativas, sem repetir. A ordem é a da API. */
export function candidatosDoBloco(bloco: BlocoAlocacao): CandidatoAlocacao[] {
  const { sugestao, alternativas } = bloco;
  return sugestao ? [sugestao, ...alternativas.filter((a) => a.id !== sugestao.id)] : alternativas;
}

/** Escolha inicial do bloco: a sugestão, se estiver apta (T-10). */
export function escolhaInicial(bloco: BlocoAlocacao) {
  return bloco.sugestao?.apto ? bloco.sugestao.id : null;
}

/** O bloco tem algum recurso apto? Sem nenhum, a senha deve ficar aguardando esse recurso. */
export function temApto(bloco: BlocoAlocacao) {
  return candidatosDoBloco(bloco).some((c) => c.apto);
}
