'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { SOCKET_URL, USAR_MOCK } from '@/lib/api/config';
import { useSessao } from '@/lib/sessao/sessao';

/** Espera para tentar de novo quando o socket não reconecta sozinho. */
export const RECONEXAO_MS = 5_000;

export interface OpcoesCanal {
  namespace: '/filas' | '/alertas';
  /** Falso enquanto falta a permissão ou a sala: não conecta e a tela segue "conectada". */
  ativo: boolean;
  query?: Readonly<Record<string, string>>;
  eventos: Readonly<Record<string, (corpo: never) => void>>;
  aoConectar?: () => void;
}

/**
 * Canal Socket.IO autenticado (`docs/04` §7), com o access token no handshake. O servidor encerra
 * a conexão quando o token expira, e nesse caso, como na recusa do handshake, o socket não
 * reconecta sozinho: tenta de novo até o token renovado pelas requisições HTTP da tela valer.
 * Na simulação (MSW) não há servidor de WebSocket: a tela fica "conectada" e revalida por HTTP.
 */
export function useCanalTempoReal({ namespace, ativo, query, eventos, aoConectar }: OpcoesCanal) {
  const { obterToken } = useSessao();
  const [conectado, setConectado] = useState(true);
  const ouvintes = useRef({ eventos, aoConectar });
  ouvintes.current = { eventos, aoConectar };

  const nomes = Object.keys(eventos).join();
  const sala = JSON.stringify(query);

  useEffect(() => {
    if (USAR_MOCK || !ativo) return;
    const socket = io(`${SOCKET_URL}${namespace}`, {
      auth: (enviar) => enviar({ token: obterToken() }),
      query: sala ? (JSON.parse(sala) as Record<string, string>) : undefined,
      transports: ['websocket'],
    });
    let tentativa: ReturnType<typeof setTimeout> | undefined;
    const tentarDeNovo = () => {
      clearTimeout(tentativa);
      tentativa = setTimeout(() => socket.connect(), RECONEXAO_MS);
    };

    socket.on('connect', () => {
      clearTimeout(tentativa);
      setConectado(true);
      ouvintes.current.aoConectar?.();
    });
    socket.on('disconnect', (motivo: string) => {
      setConectado(false);
      if (motivo === 'io server disconnect') tentarDeNovo();
    });
    socket.on('connect_error', () => {
      setConectado(false);
      if (!socket.active) tentarDeNovo();
    });
    for (const nome of nomes.split(',').filter(Boolean)) {
      socket.on(nome, (corpo: unknown) => {
        const ouvinte = ouvintes.current.eventos[nome] as ((corpo: unknown) => void) | undefined;
        ouvinte?.(corpo);
      });
    }

    return () => {
      clearTimeout(tentativa);
      socket.disconnect();
      setConectado(true);
    };
  }, [namespace, ativo, sala, nomes, obterToken]);

  return { conectado };
}
