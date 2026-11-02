import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { diaLocal } from '@/lib/home-fontes';
import { useSessao } from '@/lib/sessao/sessao';
import { COOKIE_PERMISSOES_DEV } from '@/mocks/cookies';
import {
  comSessaoAnterior,
  renderizarComSessao,
  servidor,
  usarServidorMock,
} from '@/test/servidor-mock';

import Home from './page';

usarServidorMock();

/** O layout `(autenticado)` só mostra a tela depois de a sessão carregar. */
function ComSessao({ children }: { children: ReactNode }) {
  return useSessao().usuario ? children : null;
}

function abrir(permissoes: string[]) {
  document.cookie = `${COOKIE_PERMISSOES_DEV}=${permissoes.join(',')}; Path=/`;
  comSessaoAnterior();
  renderizarComSessao(
    <ComSessao>
      <Home />
    </ComSessao>,
  );
  return userEvent.setup();
}

const pagina = (dados: unknown[], total = dados.length) =>
  HttpResponse.json({
    dados,
    meta: { pagina: 1, tamanho: 5, total, totalPaginas: 1 },
  });

const cartao = (nome: RegExp) => screen.findByRole('link', { name: nome });

describe('home por perfil (W-02) com dados da API', () => {
  it('cartão e bloco de triagem usam o total do dia, consultando só o dia de hoje', async () => {
    let consulta = new URLSearchParams();
    servidor.use(
      http.get(`${API_URL}/triagens`, ({ request }) => {
        consulta = new URL(request.url).searchParams;
        return pagina(
          [
            {
              id: 't1',
              pacienteIniciais: 'A.R.',
              especialidade: 'Nutrição',
              senhaEmitida: false,
            },
          ],
          7,
        );
      }),
    );
    abrir(['triagem:consultar', 'triagem:criar']);

    expect(await cartao(/^Triagens hoje: 7 triagens$/)).toBeVisible();
    const lista = await screen.findByRole('list', { name: 'Triagens do dia' });
    expect(within(lista).getByText('A.R. · Nutrição')).toBeVisible();
    expect(screen.getByText('E mais 6 no módulo.')).toBeVisible();
    expect(consulta.get('de')).toBe(diaLocal(new Date()));
    expect(consulta.get('ate')).toBe(diaLocal(new Date()));
  });

  it('soma as senhas aguardando de todas as filas, pelas métricas do quadro', async () => {
    abrir(['fila:consultar']);

    const lista = await screen.findByRole('list', { name: 'Fila resumida' });
    const itens = within(lista).getAllByRole('listitem');
    const contagens = itens.map((i) => Number(/(\d+) aguardando/.exec(i.textContent)![1]));
    expect(contagens).toEqual([...contagens].sort((a, b) => b - a));
    const soma = contagens.reduce((a, b) => a + b, 0);
    expect(await cartao(new RegExp(`^Aguardando na fila: ${soma} senhas?$`))).toBeVisible();
    expect(screen.getByText(/chamadas suspensas/)).toBeVisible();
  });

  it('bloco sem dados mostra o texto de vazio e o cartão mostra zero', async () => {
    servidor.use(http.get(`${API_URL}/alertas`, () => pagina([])));
    abrir(['alertas:consultar', 'indicadores:consultar']);

    expect(await screen.findByText('Nenhum alerta de SLA em aberto.')).toBeVisible();
    expect(await cartao(/^Alertas de SLA: 0 alertas$/)).toBeVisible();
  });

  it('falha em um bloco não derruba os outros e oferece tentar de novo', async () => {
    let falhar = true;
    servidor.use(
      http.get(`${API_URL}/alertas`, () =>
        falhar ? HttpResponse.json({ status: 500 }, { status: 500 }) : pagina([]),
      ),
      http.get(`${API_URL}/atendimentos`, () => pagina([])),
    );
    const usuario = abrir([
      'alertas:consultar',
      'indicadores:consultar',
      'atendimento:consultar',
      'atendimento:validar',
    ]);

    const erro = await screen.findByRole('alert');
    expect(erro).toHaveTextContent('Não foi possível carregar "Filas e alertas de SLA"');
    expect(await cartao(/^Alertas de SLA: sem dados no momento$/)).toBeVisible();
    expect(await screen.findByText('Nenhum atendimento aguardando sua validação.')).toBeVisible();

    falhar = false;
    await usuario.click(within(erro).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum alerta de SLA em aberto.')).toBeVisible();
  });

  it('sem a permissão de leitura, não consulta nem afirma que não há dados', async () => {
    let consultou = false;
    servidor.use(
      http.get(`${API_URL}/triagens`, () => {
        consultou = true;
        return pagina([]);
      }),
    );
    abrir(['triagem:criar']);

    expect(await screen.findByText('Seu perfil não consulta estes dados.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Nova triagem' })).toBeVisible();
    expect(screen.queryByText('Nenhuma triagem registrada hoje.')).not.toBeInTheDocument();
    await waitFor(() => expect(consultou).toBe(false));
  });
});
