import { type TipoAtendimento } from '@filas/contracts';

import { type ClienteHttp } from '@/lib/api/cliente-http';
import { type Pagina } from '@/lib/cadastros/tipos';

import { type Chamada, type Fila, type QuadroFila, type ResultadoChamada } from './tipos';

/** O quadro mostra as senhas ativas de uma vez; 100 é o teto de página (`docs/04` §5). */
export const TAMANHO_QUADRO = 100;

export function criarFilaApi(cliente: ClienteHttp) {
  return {
    listarFilas: () =>
      cliente.requisitar<Pagina<Fila>>(`/filas?ativa=true&pagina=1&tamanho=${TAMANHO_QUADRO}`),

    quadro: (filaId: string, tipoAtendimento: TipoAtendimento | '') => {
      const parametros = new URLSearchParams({ pagina: '1', tamanho: String(TAMANHO_QUADRO) });
      if (tipoAtendimento) parametros.set('tipoAtendimento', tipoAtendimento);
      return cliente.requisitar<QuadroFila>(
        `/filas/${encodeURIComponent(filaId)}/senhas?${parametros.toString()}`,
      );
    },

    /**
     * "Chamar próxima" (UC-09). A mesma `chaveIdempotencia` em duplo clique ou reenvio devolve a
     * mesma chamada, sem chamar outra senha (`docs/04` §6).
     */
    chamarProxima: (filaId: string, chaveIdempotencia: string) =>
      cliente.requisitar<ResultadoChamada>(`/filas/${encodeURIComponent(filaId)}/chamadas`, {
        metodo: 'POST',
        corpo: {},
        cabecalhos: { 'Idempotency-Key': chaveIdempotencia },
      }),

    rechamar: (chamadaId: string) =>
      cliente.requisitar<Chamada>(`/chamadas/${encodeURIComponent(chamadaId)}/rechamada`, {
        metodo: 'POST',
      }),
  };
}

export type FilaApi = ReturnType<typeof criarFilaApi>;
