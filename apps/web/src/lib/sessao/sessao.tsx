'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type ClienteHttp, criarClienteHttp } from '@/lib/api/cliente-http';

import { limparEstadoLocal } from './estado-local';
import {
  type DadosLogin,
  type RespostaLogin,
  type RespostaRefresh,
  type UsuarioSessao,
} from './tipos';

export type EstadoSessao = 'carregando' | 'autenticado' | 'anonimo';

/** Por que a sessão terminou: expirou (401 sem refresh possível) ou a pessoa clicou em "Sair". */
export type Encerramento = 'expirou' | 'saiu' | null;

export interface Sessao {
  estado: EstadoSessao;
  usuario: UsuarioSessao | null;
  permissoes: readonly string[];
  encerramento: Encerramento;
  entrar: (dados: DadosLogin) => Promise<void>;
  sair: () => Promise<void>;
  cliente: ClienteHttp;
}

const SessaoContext = createContext<Sessao | null>(null);

export interface SessaoProviderProps {
  baseUrl: string;
  children: ReactNode;
}

/**
 * Sessão do front (`docs/04-contrato-api.md` §2). O access token fica só em memória, nunca em
 * `localStorage`; ao recarregar a página, a sessão volta pelo cookie de refresh.
 */
export function SessaoProvider({ baseUrl, children }: SessaoProviderProps) {
  const queryClient = useQueryClient();
  const token = useRef<string | null>(null);
  const [estado, setEstado] = useState<EstadoSessao>('carregando');
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [encerramento, setEncerramento] = useState<Encerramento>(null);

  const cliente = useMemo(() => {
    const http: ClienteHttp = criarClienteHttp({
      baseUrl,
      obterToken: () => token.current,
      async renovarToken() {
        try {
          const resposta = await http.requisitar<RespostaRefresh>('/auth/refresh', {
            metodo: 'POST',
            semRenovar: true,
          });
          token.current = resposta.accessToken;
          return true;
        } catch {
          return false;
        }
      },
      aoPerderSessao() {
        token.current = null;
        setUsuario(null);
        setEncerramento('expirou');
        setEstado('anonimo');
      },
    });
    return http;
  }, [baseUrl]);

  const restaurado = useRef(false);
  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;
    void (async () => {
      try {
        const { accessToken } = await cliente.requisitar<RespostaRefresh>('/auth/refresh', {
          metodo: 'POST',
          semRenovar: true,
        });
        token.current = accessToken;
        setUsuario(await cliente.requisitar<UsuarioSessao>('/auth/me'));
        setEstado('autenticado');
      } catch {
        token.current = null;
        setEstado('anonimo');
      }
    })();
  }, [cliente]);

  const entrar = useCallback(
    async (dados: DadosLogin) => {
      const resposta = await cliente.requisitar<RespostaLogin>('/auth/login', {
        metodo: 'POST',
        corpo: dados,
        semRenovar: true,
      });
      token.current = resposta.accessToken;
      limparEstadoLocal();
      setUsuario(resposta.usuario);
      setEncerramento(null);
      setEstado('autenticado');
    },
    [cliente],
  );

  const sair = useCallback(async () => {
    try {
      await cliente.requisitar('/auth/logout', { metodo: 'POST', semRenovar: true });
    } catch {
      // A sessão local é encerrada mesmo se o servidor não responder.
    }
    token.current = null;
    queryClient.clear();
    limparEstadoLocal();
    setUsuario(null);
    setEncerramento('saiu');
    setEstado('anonimo');
  }, [cliente, queryClient]);

  const valor = useMemo<Sessao>(
    () => ({
      estado,
      usuario,
      permissoes: usuario?.permissoes ?? [],
      encerramento,
      entrar,
      sair,
      cliente,
    }),
    [estado, usuario, encerramento, entrar, sair, cliente],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao(): Sessao {
  const sessao = useContext(SessaoContext);
  if (!sessao) throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  return sessao;
}

/** Usuário da sessão em telas autenticadas (o layout `(autenticado)` garante que existe). */
export function useUsuario(): UsuarioSessao {
  const { usuario } = useSessao();
  if (!usuario) throw new Error('useUsuario só pode ser usado em tela autenticada.');
  return usuario;
}
