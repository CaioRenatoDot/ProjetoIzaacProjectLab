import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { criarClienteHttp } from '@/lib/api/cliente-http';
import { assinarAusenciasAutomaticas, reiniciarMockAusencias } from '@/mocks/ausencias';
import { renderizar } from '@/test/renderizar';
import { servidor, usarServidorMock } from '@/test/servidor-mock';

import { TelaAusencias } from './tela-ausencias';

usarServidorMock();

function preparar(permissoes = ['ausencia:consultar', 'ausencia:criar', 'fila:consultar']) {
  const cliente = criarClienteHttp({
    baseUrl: API_URL,
    obterToken: () => `mock.usuario-admin.${Date.now() + 60_000}`,
    renovarToken: () => Promise.resolve(false),
    aoPerderSessao: () => {},
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderizar(
    <QueryClientProvider client={cache}>
      <TelaAusencias
        cliente={cliente}
        simulacao={{ reiniciar: reiniciarMockAusencias, assinar: assinarAusenciasAutomaticas }}
      />
    </QueryClientProvider>,
    permissoes,
  );
  return userEvent.setup();
}

describe('tela de ausência e desistência com cliente HTTP e MSW', () => {
  it('RN-12 e RN-13: registra ausência, atualiza status e preserva o aviso após recarregar', async () => {
    const usuario = preparar();
    const card = await screen.findByRole('article', { name: 'Senha F014' });
    await usuario.click(within(card).getByRole('button', { name: 'Detalhes da senha F014' }));
    await usuario.click(screen.getByRole('button', { name: 'Registrar ausência' }));
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(within(card).getByText('Ausente', { exact: true })).toBeVisible());
    expect(await screen.findByText(/Restrição aplicada:/)).toBeVisible();
    await usuario.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(screen.getByText(/Restrição aplicada:/)).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('conclui desistência por HTTP e atualiza a senha', async () => {
    const usuario = preparar();
    const card = await screen.findByRole('article', { name: 'Senha F015' });
    await usuario.click(within(card).getByRole('button', { name: 'Detalhes da senha F015' }));
    await usuario.click(screen.getByRole('button', { name: 'Registrar desistência' }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await within(card).findByText('Desistência', { exact: true })).toBeVisible();
  });

  it('sem permissão mostra estado neutro', async () => {
    preparar([]);
    expect(await screen.findByText('Acesso não permitido')).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('consulta sem escrita não oferece ações destrutivas', async () => {
    const usuario = preparar(['ausencia:consultar', 'fila:consultar']);
    const card = await screen.findByRole('article', { name: 'Senha F013' });
    await usuario.click(within(card).getByRole('button', { name: 'Detalhes da senha F013' }));
    expect(screen.queryByRole('button', { name: 'Registrar ausência' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar desistência' })).not.toBeInTheDocument();
  });

  it('lista de filas vazia apresenta estado vazio', async () => {
    servidor.use(
      http.get(`${API_URL}/filas`, () =>
        HttpResponse.json({
          dados: [],
          meta: { pagina: 1, tamanho: 100, total: 0, totalPaginas: 0 },
        }),
      ),
    );
    preparar();
    expect(await screen.findByText('Nenhuma fila disponível')).toBeVisible();
  });

  it('erro de rede permite tentar novamente', async () => {
    servidor.use(http.get(`${API_URL}/filas`, () => HttpResponse.error()));
    const usuario = preparar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as senhas',
    );
    servidor.resetHandlers();
    await usuario.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('article', { name: 'Senha F013' })).toBeVisible();
  });
});
