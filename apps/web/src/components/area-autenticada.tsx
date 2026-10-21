'use client';

import { EstadoCarregando } from '@filas/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { Shell } from '@/components/shell';
import { urlLogin } from '@/lib/sessao/destino';
import { useSessao } from '@/lib/sessao/sessao';

/**
 * Rotas internas só com sessão. Sem ela, vai para `/login?redirect=<rota>` e volta para a rota
 * depois de entrar; se a sessão expirou, o login mostra o aviso (T-01). Depois de "Sair", vai
 * para `/login` sem rota de volta.
 */
export function AreaAutenticada({ children }: { children: ReactNode }) {
  const { estado, usuario, encerramento } = useSessao();
  const router = useRouter();

  useEffect(() => {
    if (estado !== 'anonimo') return;
    if (encerramento === 'saiu') {
      router.replace('/login');
      return;
    }
    const { pathname, search } = window.location;
    router.replace(urlLogin(`${pathname}${search}`, encerramento === 'expirou'));
  }, [estado, encerramento, router]);

  if (estado !== 'autenticado' || !usuario) {
    return <EstadoCarregando rotulo="Verificando a sessão" />;
  }
  return <Shell sessao={usuario}>{children}</Shell>;
}
