import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { dispararAlertaMock, normalizarAlertaMock } from '@/mocks/alertas';
import { renderizarComSessao, servidor, usarServidorMock } from '@/test/servidor-mock';

import { TelaAlertas } from './tela-alertas';

usarServidorMock();

const GESTAO = ['alertas:consultar', 'alertas:reconhecer', 'alertas:escalonar', 'fila:consultar'];

function abrir(permissoes: string[] = GESTAO) {
  const resultado = renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaAlertas />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return { ...resultado, usuario: userEvent.setup() };
}

const emAberto = () => within(screen.getByRole('list', { name: 'Alertas em aberto' }));
const cartoes = () =>
  emAberto()
    .getAllByRole('listitem')
    .filter((li) => li.dataset.status);
const titulos = () => cartoes().map((c) => within(c).getByRole('heading').textContent);
const cartao = (especialidade: string) =>
  cartoes().find((c) => within(c).getByRole('heading').textContent === especialidade)!;
const avisos = () => screen.getByRole('status', { name: 'Avisos de alertas' });

/** Simula a revalidação periódica (a mesma que o evento de tempo real dispara). */
function revalidar() {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

async function carregado() {
  await waitFor(() => expect(cartoes()).toHaveLength(3));
}

describe('<TelaAlertas> (W-18 / T-17)', () => {
  it('lista os ativos na ordem da API e o reconhecido abaixo, com gravidade em texto', async () => {
    abrir();
    await carregado();

    expect(titulos()).toEqual(['Fonoaudiologia', 'Fisioterapia', 'Psicologia']);
    expect(cartao('Fisioterapia')).toHaveTextContent(
      'Espera de 32 min, 7 min acima do limite de 25 min',
    );
    expect(cartao('Fisioterapia')).toHaveTextContent('Senhas afetadas:6');
    expect(cartao('Psicologia')).toHaveTextContent('Reconhecido por Gestão de desenvolvimento');
  });

  it('bloqueio por falta de supervisor aparece como origem distinta (RN-10)', async () => {
    abrir();
    await carregado();
    const bloqueio = cartao('Fonoaudiologia');
    expect(within(bloqueio).getByText('Fila bloqueada')).toBeInTheDocument();
    expect(bloqueio).toHaveTextContent('Chamadas suspensas por ausência de supervisor (RN-10)');
    expect(bloqueio).not.toHaveTextContent('Espera atual');
  });

  it('reconhecer muda a aparência e desce o alerta, sem tirá-lo da lista', async () => {
    const { usuario } = abrir();
    await carregado();

    await usuario.click(screen.getByRole('button', { name: 'Reconhecer alerta de Fisioterapia' }));

    await waitFor(() =>
      expect(titulos()).toEqual(['Fonoaudiologia', 'Psicologia', 'Fisioterapia']),
    );
    expect(cartao('Fisioterapia').dataset.status).toBe('RECONHECIDO');
    expect(cartao('Fisioterapia')).toHaveTextContent('Reconhecido por Usuário de desenvolvimento');
    expect(
      screen.queryByRole('button', { name: 'Reconhecer alerta de Fisioterapia' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/Alerta de Fisioterapia reconhecido/)).toBeInTheDocument();
  });

  it('o alerta reconhecido fica depois de todos os ativos', async () => {
    const { usuario } = abrir();
    await carregado();
    await usuario.click(
      screen.getByRole('button', { name: 'Reconhecer alerta de Fonoaudiologia' }),
    );
    await waitFor(() =>
      expect(titulos()).toEqual(['Fisioterapia', 'Fonoaudiologia', 'Psicologia']),
    );
  });

  it('medida de escalonamento registra quem acionou e quando', async () => {
    const { usuario } = abrir();
    await carregado();

    await usuario.click(screen.getByRole('button', { name: 'Abrir vaga extra em Fisioterapia' }));
    const modal = screen.getByRole('dialog', { name: 'Abrir vaga extra em Fisioterapia' });
    await usuario.type(within(modal).getByLabelText('Observação (opcional)'), 'Sala 05 liberada');
    await usuario.click(within(modal).getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText(/Vaga extra acionado em Fisioterapia por Usuário de desenvolvimento/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(cartao('Fisioterapia')).toHaveTextContent(
        /Vaga extra, por Usuário de desenvolvimento em \d{2}\/\d{2},? \d{2}:\d{2}: Sala 05 liberada/,
      ),
    );
  });

  it('alerta novo entra no topo e é anunciado em aria-live educado', async () => {
    abrir();
    await carregado();
    expect(avisos()).toHaveTextContent('');
    expect(avisos()).toHaveAttribute('aria-live', 'polite');

    dispararAlertaMock({ tipo: 'FILA_BLOQUEADA', especialidade: 'Odontologia' });
    revalidar();

    await waitFor(() => expect(titulos()[0]).toBe('Odontologia'));
    expect(avisos()).toHaveTextContent('Novo alerta: Odontologia, fila bloqueada.');
  });

  it('alerta normalizado sai da lista em aberto e vai para o histórico com o horário', async () => {
    abrir();
    await carregado();
    const historico = screen.getByRole('table', { name: 'Histórico de alertas normalizados' });
    await screen.findByText('Mostrando 1–20 de 24');

    normalizarAlertaMock('alerta-1');
    revalidar();

    await waitFor(() => expect(titulos()).toEqual(['Fonoaudiologia', 'Psicologia']));
    expect(avisos()).toHaveTextContent(
      'O alerta de Fisioterapia foi normalizado e passou para o histórico.',
    );
    expect(await screen.findByText('Mostrando 1–20 de 25')).toBeInTheDocument();
    await waitFor(() => {
      const linha = within(historico).getAllByRole('row')[1]!;
      expect(linha).toHaveTextContent('Fisioterapia');
      expect(linha).toHaveTextContent(/\d{2}\/\d{2},? \d{2}:\d{2}$/);
    });
  });

  it('sem alertas em aberto, mostra o estado vazio positivo e mantém o histórico', async () => {
    servidor.use(
      http.get(`${API_URL}/alertas`, ({ request }) =>
        new URL(request.url).searchParams.getAll('status').includes('ATIVO')
          ? HttpResponse.json({
              dados: [],
              meta: { pagina: 1, tamanho: 100, total: 0, totalPaginas: 1 },
            })
          : undefined,
      ),
    );
    abrir();
    expect(await screen.findByText('Nenhum alerta ativo')).toBeInTheDocument();
    expect(
      await screen.findByRole('table', { name: 'Histórico de alertas normalizados' }),
    ).toBeInTheDocument();
  });

  it('supervisor (só consulta) vê os alertas sem as ações de reconhecer e escalonar', async () => {
    abrir(['alertas:consultar']);
    await carregado();
    expect(screen.queryByRole('button', { name: /^Reconhecer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reforçar|^Abrir vaga|^Escalonar/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Ver fila/ })).not.toBeInTheDocument();
  });

  it('"Ver fila" leva ao painel filtrado pela fila do alerta', async () => {
    abrir();
    await carregado();
    expect(screen.getByRole('link', { name: 'Ver fila de Fisioterapia' })).toHaveAttribute(
      'href',
      '/fila?filaId=fila-1',
    );
  });

  it('sem alertas:consultar, mostra o estado sem permissão neutro', () => {
    abrir(['indicadores:consultar']);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Alertas de SLA' })).not.toBeInTheDocument();
  });

  it('erro de carga oferece "Tentar novamente"', async () => {
    servidor.use(http.get(`${API_URL}/alertas`, () => HttpResponse.json({}, { status: 500 })));
    abrir();
    expect(
      await screen.findByText(
        'Não foi possível carregar os alertas. Verifique a conexão e tente novamente.',
      ),
    ).toBeInTheDocument();
  });
});
