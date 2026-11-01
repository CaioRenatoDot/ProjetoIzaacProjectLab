'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { SOCKET_URL, USAR_MOCK } from '@/lib/api/config';
import { type SenhaResumo } from '@/lib/fila/tipos';
import { useSessao } from '@/lib/sessao/sessao';

/** Eventos do namespace `/filas` (`docs/04` §7). Todos mudam o quadro: invalidam o cache. */
export const EVENTOS_FILA = [
  'senha.criada',
  'senha.chamada',
  'senha.status_alterado',
  'senha.reclassificada',
  'fila.bloqueada',
  'fila.desbloqueada',
  'fila.metricas',
] as const;

/**
 * Tempo real do painel de fila. Conecta em `/filas` com o access token no handshake e entra na
 * sala da especialidade; cada evento invalida o quadro, e `senha.chamada` é anunciado.
 * Na simulação (MSW) não há servidor de WebSocket: a tela fica "conectada" e revalida por HTTP.
 */
export function useTempoRealFila(
  especialidadeId: string | undefined,
  aoChamar: (senha: SenhaResumo) => void,
) {
  const { obterToken } = useSessao();
  const queryClient = useQueryClient();
  const [conectado, setConectado] = useState(true);
  const aoChamarAtual = useRef(aoChamar);
  aoChamarAtual.current = aoChamar;

  useEffect(() => {
    if (USAR_MOCK || !especialidadeId) return;
    const socket = io(`${SOCKET_URL}/filas`, {
      auth: (enviar) => enviar({ token: obterToken() }),
      // Sala `especialidade:{id}`: a forma de entrar nela não está no contrato (docs/07).
      query: { especialidadeId },
      transports: ['websocket'],
    });
    const invalidar = () => void queryClient.invalidateQueries({ queryKey: ['fila'] });

    socket.on('connect', () => {
      setConectado(true);
      invalidar();
    });
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    for (const evento of EVENTOS_FILA) socket.on(evento, invalidar);
    socket.on('senha.chamada', (corpo: { senha: SenhaResumo }) =>
      aoChamarAtual.current(corpo.senha),
    );

    return () => {
      socket.disconnect();
    };
  }, [especialidadeId, obterToken, queryClient]);

  return { conectado };
}
