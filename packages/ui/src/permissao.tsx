'use client';

import { createContext, type ReactNode, useContext } from 'react';

/** Permissão no formato `modulo:operacao` (docs/04-contrato-api.md §3). */
export type Permissao = `${string}:${string}`;

const PermissoesContext = createContext<readonly string[]>([]);

export interface PermissoesProviderProps {
  /** Lista `permissoes` da sessão. Nunca derivar de nome de perfil (ADR-002). */
  permissoes: readonly string[];
  children: ReactNode;
}

export function PermissoesProvider({ permissoes, children }: PermissoesProviderProps) {
  return <PermissoesContext.Provider value={permissoes}>{children}</PermissoesContext.Provider>;
}

export function usePermissoes() {
  const permissoes = useContext(PermissoesContext);
  return {
    permissoes,
    tem: (permissao: Permissao) => permissoes.includes(permissao),
  };
}

export interface PermitidoProps {
  permissao: Permissao;
  children: ReactNode;
}

/**
 * Renderiza o conteúdo apenas com a permissão. Sem ela não renderiza nada:
 * ação sem permissão nunca aparece desabilitada (docs/01-arquitetura.md §4.1).
 */
export function Permitido({ permissao, children }: PermitidoProps) {
  const { tem } = usePermissoes();
  return tem(permissao) ? <>{children}</> : null;
}
