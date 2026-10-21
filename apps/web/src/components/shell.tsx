'use client';

import {
  BannerConexao,
  Button,
  ConexaoProvider,
  PermissoesProvider,
  ToastProvider,
} from '@filas/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { modulosVisiveis } from '@/lib/modulos';
import { type Sessao } from '@/lib/sessao';

export interface ShellProps {
  sessao: Sessao;
  children: ReactNode;
}

/**
 * Moldura de toda tela autenticada. Abaixo de 1280 px o menu fica recolhido atrás do botão
 * "Menu" (especificação de UI §3); a partir disso, fica fixo e pode ser recolhido.
 */
export function Shell({ sessao, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const desktop = useDesktop();
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuFixoRecolhido, setMenuFixoRecolhido] = useState(false);
  const modulos = modulosVisiveis(sessao.permissoes);

  function alternarMenu() {
    if (desktop) setMenuFixoRecolhido((r) => !r);
    else setMenuAberto((a) => !a);
  }

  function sair() {
    // Encerrar a sessão no servidor entra com a parte 3.3 (#33).
    router.push('/login');
  }

  const visivelNoDesktop = menuFixoRecolhido ? 'xl:hidden' : 'xl:flex';
  const menuExpandido = desktop ? !menuFixoRecolhido : menuAberto;

  return (
    <PermissoesProvider permissoes={sessao.permissoes}>
      {/* Conexão sempre ativa até o tempo real entrar (Etapa 6). */}
      <ConexaoProvider conectado>
        <ToastProvider>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-superficie focus:p-3"
          >
            Pular para o conteúdo
          </a>
          <div className="flex min-h-screen flex-col">
            <header className="flex items-center gap-4 border-b border-borda-suave bg-superficie px-4 py-2">
              <Button
                onClick={alternarMenu}
                aria-controls="menu-modulos"
                aria-expanded={menuExpandido}
                variante="secundario"
              >
                Menu
              </Button>
              <span className="font-semibold">{sessao.unidadeNome}</span>
              <div className="ml-auto flex items-center gap-4">
                <span className="hidden text-right md:block">
                  <span className="block">{sessao.nome}</span>
                  <span className="block text-secundario text-texto-secundario">
                    Perfil: {sessao.perfilNome}
                  </span>
                </span>
                <Button onClick={sair} variante="secundario">
                  Sair
                </Button>
              </div>
            </header>
            <BannerConexao />
            <div className="relative flex flex-1">
              <nav
                id="menu-modulos"
                aria-label="Módulos"
                className={`${menuAberto ? 'flex' : 'hidden'} ${visivelNoDesktop} absolute inset-y-0 left-0 z-40 w-60 flex-col border-r border-borda-suave bg-superficie-elevada p-2 shadow-lg xl:static xl:shadow-none`}
              >
                <ul className="flex flex-col gap-1">
                  {modulos.map((m) => {
                    const ativo = pathname === m.rota || pathname.startsWith(`${m.rota}/`);
                    return (
                      <li key={m.rota}>
                        <Link
                          href={m.rota}
                          aria-current={ativo ? 'page' : undefined}
                          onClick={() => setMenuAberto(false)}
                          className={`flex min-h-toque items-center rounded-md px-3 ${ativo ? 'bg-primaria text-texto-invertido' : 'text-texto hover:bg-superficie-hover'}`}
                        >
                          {m.rotulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <main id="conteudo" className="min-w-0 flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
        </ToastProvider>
      </ConexaoProvider>
    </PermissoesProvider>
  );
}

const CONSULTA_DESKTOP = '(min-width: 1280px)';

function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_DESKTOP);
    setDesktop(consulta.matches);
    const atualizar = (e: MediaQueryListEvent) => setDesktop(e.matches);
    consulta.addEventListener('change', atualizar);
    return () => consulta.removeEventListener('change', atualizar);
  }, []);
  return desktop;
}
