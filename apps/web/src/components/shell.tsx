'use client';

import { BannerConexao, ConexaoProvider, PermissoesProvider, ToastProvider } from '@filas/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { modulosVisiveis } from '@/lib/modulos';
import { useSessao } from '@/lib/sessao/sessao';
import { type UsuarioSessao } from '@/lib/sessao/tipos';

export interface ShellProps {
  sessao: UsuarioSessao;
  children: ReactNode;
}

/**
 * Moldura de toda tela autenticada. Abaixo de 1280 px o menu fica recolhido atrás do botão
 * "Menu" (especificação de UI §3); a partir disso, fica fixo e pode ser recolhido.
 */
export function Shell({ sessao, children }: ShellProps) {
  const pathname = usePathname();
  const { sair } = useSessao();
  const desktop = useDesktop();
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuFixoRecolhido, setMenuFixoRecolhido] = useState(false);
  const modulos = modulosVisiveis(sessao.permissoes);

  function alternarMenu() {
    if (desktop) setMenuFixoRecolhido((r) => !r);
    else setMenuAberto((a) => !a);
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
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:flex focus:items-center focus:gap-2 focus:rounded-full focus:bg-informacao focus:px-5 focus:py-3 focus:font-semibold focus:text-texto-invertido focus:shadow-xl focus:ring-4 focus:ring-informacao/30 focus:outline-none"
          >
            Pular para o conteúdo
          </a>
          <div className="flex h-dvh flex-col overflow-hidden">
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-borda-suave bg-superficie/90 px-4 py-2 backdrop-blur">
              <button
                type="button"
                onClick={alternarMenu}
                aria-controls="menu-modulos"
                aria-expanded={menuExpandido}
                className="flex min-h-toque items-center gap-2 rounded-xl border border-borda px-3 font-medium transition hover:bg-superficie-hover focus-visible:ring-4 focus-visible:ring-informacao/30 focus-visible:outline-none"
              >
                <Icone nome="menu" />
                Menu
              </button>
              <MarcaUnidade nome={sessao.unidadeNome} />
              <div className="ml-auto flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="hidden size-10 items-center justify-center rounded-full bg-informacao font-semibold text-texto-invertido md:flex"
                >
                  {iniciais(sessao.nome)}
                </span>
                <span className="hidden md:block">
                  <span className="block">{sessao.nome}</span>
                  <span className="block text-secundario text-texto-secundario">
                    Perfil: {sessao.perfilNome}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void sair()}
                  aria-label="Sair"
                  title="Sair"
                  className="flex size-11 items-center justify-center rounded-xl text-texto-secundario transition hover:bg-[#fee2e2] hover:text-erro focus-visible:ring-4 focus-visible:ring-informacao/30 focus-visible:outline-none active:scale-90 motion-reduce:transition-none"
                >
                  <Icone nome="sair" />
                </button>
              </div>
            </header>
            <BannerConexao />
            <div className="relative flex min-h-0 flex-1">
              <nav
                id="menu-modulos"
                aria-label="Módulos"
                className={`${menuAberto ? 'flex' : 'hidden'} ${visivelNoDesktop} absolute inset-y-0 left-0 z-40 w-64 flex-col overflow-y-auto border-r border-borda-suave bg-superficie p-3 shadow-xl xl:static xl:shadow-none`}
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
                          className={`relative flex min-h-toque items-center gap-3 rounded-xl px-3 font-medium transition focus-visible:ring-4 focus-visible:ring-informacao/30 focus-visible:outline-none ${ativo ? 'bg-[#dbeafe] text-[#1e3a8a] before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-informacao' : 'text-texto-secundario hover:bg-superficie-hover hover:text-texto'}`}
                        >
                          <Icone nome={m.rota} />
                          {m.rotulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <main
                id="conteudo"
                tabIndex={-1}
                className="min-w-0 flex-1 overflow-y-auto p-6 focus:outline-none"
              >
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

const iniciais = (nome: string) =>
  nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('pt-BR'))
    .join('');

/** Ícones de traço (24 px) do menu; decorativos, o nome do módulo é o rótulo. */
const ICONES: Record<string, string> = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  sair: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h10',
  '/acesso': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  '/cadastros': 'M4 5h16v14H4zM8 9h8M8 13h8M8 17h5',
  '/triagem': 'M9 4h6v3H9zM6 6h12v15H6zM9 12h6M12 9v6',
  '/fila': 'M4 6h4M4 12h4M4 18h4M11 6h9M11 12h9M11 18h9',
  '/chamada': 'M4 10v4h3l5 4V6L7 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  '/alocacao': 'M4 20v-2a4 4 0 0 1 4-4h3M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15 14h6v6h-6z',
  '/atendimento':
    'M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2M20 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  '/encaminhamento': 'M4 12h13M13 6l6 6-6 6',
  '/ausencias': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  '/indicadores': 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  '/auditoria': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
};

function Icone({ nome }: { nome: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONES[nome] ?? 'M5 12h14'} />
    </svg>
  );
}

/** Logotipo e nome da unidade, no cabeçalho. */
function MarcaUnidade({ nome }: { nome: string }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-8 shrink-0">
        <rect width="48" height="48" rx="12" fill="#1d4ed8" />
        <path
          d="M12 15a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z"
          fill="#fff"
        />
      </svg>
      {nome}
    </span>
  );
}
