import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { useSessao } from '@/lib/sessao/sessao';
import {
  comSessaoAnterior,
  renderizarComSessao,
  servidor,
  usarServidorMock,
} from '@/test/servidor-mock';

import { AreaAutenticada } from './area-autenticada';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => window.location.pathname,
}));

usarServidorMock();
beforeEach(() => {
  replace.mockClear();
  // O shell consulta o breakpoint; o jsdom não implementa matchMedia.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  window.history.pushState({}, '', '/triagem?etapa=2');
});

/** Conteúdo de teste que faz uma requisição autenticada sob demanda. */
function Conteudo() {
  const { cliente } = useSessao();
  return (
    <button type="button" onClick={() => void cliente.requisitar('/protegido').catch(() => {})}>
      Consultar
    </button>
  );
}

const abrir = () =>
  renderizarComSessao(
    <AreaAutenticada>
      <Conteudo />
    </AreaAutenticada>,
  );

describe('<AreaAutenticada>', () => {
  it('sem sessão, vai para o login guardando a rota de destino', async () => {
    abrir();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/login?redirect=%2Ftriagem%3Fetapa%3D2'),
    );
    expect(screen.queryByRole('button', { name: 'Consultar' })).not.toBeInTheDocument();
  });

  it('com o cookie de refresh (página recarregada), a sessão continua e mostra o shell', async () => {
    comSessaoAnterior();
    abrir();
    expect(await screen.findByText('Usuário de desenvolvimento')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('nenhum token fica em localStorage ou sessionStorage', async () => {
    comSessaoAnterior();
    abrir();
    await screen.findByText('Usuário de desenvolvimento');
    const guardado = [window.localStorage, window.sessionStorage]
      .flatMap((s) => Array.from({ length: s.length }, (_, i) => s.getItem(s.key(i) ?? '')))
      .join(' ');
    expect(guardado).not.toMatch(/mock\./);
  });

  it('sessão expirada (401 sem refresh possível) volta ao login com o aviso', async () => {
    comSessaoAnterior();
    // O primeiro refresh (restaurar a sessão) funciona; o seguinte, depois do 401, falha.
    let refreshes = 0;
    servidor.use(
      http.get(`${API_URL}/protegido`, () =>
        HttpResponse.json({ status: 401, codigo: 'NAO_AUTENTICADO' }, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshes += 1;
        return refreshes === 1
          ? HttpResponse.json({ accessToken: 'mock.usuario-admin.9999999999999', expiraEm: 900 })
          : HttpResponse.json({ status: 401, codigo: 'NAO_AUTENTICADO' }, { status: 401 });
      }),
    );
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Consultar' }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/login?redirect=%2Ftriagem%3Fetapa%3D2&expirada=1'),
    );
  });

  it('"Sair" encerra a sessão e vai para /login sem rota de volta', async () => {
    comSessaoAnterior();
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(document.cookie).not.toMatch(/filas-mock-refresh=usuario/);
  });
});
