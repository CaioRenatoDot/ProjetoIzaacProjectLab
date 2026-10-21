'use client';

import { createContext, type ReactNode, useContext } from 'react';

const ConexaoContext = createContext(true);

export interface ConexaoProviderProps {
  /** Estado da conexão de tempo real. Quem gerencia o socket informa aqui. */
  conectado: boolean;
  children: ReactNode;
}

export function ConexaoProvider({ conectado, children }: ConexaoProviderProps) {
  return <ConexaoContext.Provider value={conectado}>{children}</ConexaoContext.Provider>;
}

/**
 * Sem conexão, as ações de escrita ficam congeladas e a leitura mostra o último estado
 * (docs/04-contrato-api.md §7, RNF-04). Telas usam `podeEscrever` para bloquear envios.
 */
export function useConexao() {
  const conectado = useContext(ConexaoContext);
  return { conectado, podeEscrever: conectado };
}

/** Banner persistente exibido enquanto a conexão estiver perdida. */
export function BannerConexao() {
  const { conectado } = useConexao();
  if (conectado) return null;
  return (
    <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-amber-950">
      Conexão perdida. Os dados podem estar desatualizados e as ações de alteração estão pausadas
      até a conexão voltar.
    </div>
  );
}
