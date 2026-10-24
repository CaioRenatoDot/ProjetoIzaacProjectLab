import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { comSessaoAnterior, renderizarComSessao, usarServidorMock } from '@/test/servidor-mock';

import { TelaAlocacao } from './tela-alocacao';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

usarServidorMock();
beforeEach(() => push.mockClear());

function abrir(senhaId: string, permissoes = ['alocacao:criar']) {
  comSessaoAnterior();
  renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaAlocacao senhaId={senhaId} />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return userEvent.setup();
}

const bloco = (nome: RegExp) => screen.getByRole('group', { name: nome });
const confirmar = () => screen.getByRole('button', { name: /^Confirmar alocação|^Confirmando/ });

describe('<TelaAlocacao> (W-11 / T-10)', () => {
  it('três blocos com a sugestão escolhida e "Confirmar alocação" disponível', async () => {
    abrir('senha-f013');
    expect(
      await screen.findByRole('heading', { name: 'Alocação de recursos: senha F013' }),
    ).toBeInTheDocument();
    for (const nome of [/Estudante\/atendente/, /Supervisor/, /Sala/]) {
      expect(bloco(nome)).toBeInTheDocument();
    }
    expect(within(bloco(/Estudante/)).getByRole('radio', { name: /Bruno Lima/ })).toBeChecked();
    expect(confirmar()).toBeEnabled();
  });

  it('RN-05: estudante com atendimento ativo aparece inapto, com o motivo escrito no item', async () => {
    abrir('senha-f013');
    const carla = await screen.findByRole('radio', { name: /Carla Souza/ });
    expect(carla).toBeDisabled();
    expect(carla.closest('label')).toHaveTextContent('Inapto: Já possui atendimento ativo');
    expect(
      screen.getByRole('radio', { name: /Prof\. Fábio Reis/ }).closest('label'),
    ).toHaveTextContent('Inapto: Limite de supervisão atingido (3 de 3)');
  });

  it('RN-07: sem supervisão exigida, o bloco de supervisor não aparece e há o aviso', async () => {
    abrir('senha-n105');
    await screen.findByRole('heading', { name: 'Alocação de recursos: senha N105' });
    expect(screen.queryByRole('group', { name: /Supervisor/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/não exige supervisão docente: a etapa de supervisor não se aplica/),
    ).toBeInTheDocument();
    expect(confirmar()).toBeEnabled();
  });

  it('recurso indisponível na confirmação mostra o erro, recarrega as alternativas e não confirma', async () => {
    const usuario = abrir('senha-f013');
    await usuario.click(await screen.findByRole('radio', { name: /Ana Ribeiro/ }));
    await usuario.click(confirmar());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Ana Ribeiro acabou de iniciar outro atendimento/,
    );
    const ana = await screen.findByRole('radio', { name: /Ana Ribeiro/ });
    await waitFor(() => expect(ana).toBeDisabled());
    expect(ana.closest('label')).toHaveTextContent('Inapto: Já possui atendimento ativo');
    expect(within(bloco(/Estudante/)).getByRole('radio', { name: /Bruno Lima/ })).toBeChecked();
    expect(push).not.toHaveBeenCalled();
  });

  it('confirmar com os recursos aptos volta para a fila com o aviso', async () => {
    const usuario = abrir('senha-f013');
    await screen.findByRole('radio', { name: /Bruno Lima/ });
    await usuario.click(confirmar());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/fila'));
    expect(
      screen.getByText('Recursos alocados à senha F013: Bruno Lima, Prof. Elisa Nunes, Sala 03.', {
        selector: 'div',
      }),
    ).toBeInTheDocument();
  });

  it('sem sala compatível, "Confirmar" fica desabilitado e a senha pode ficar aguardando a sala', async () => {
    const usuario = abrir('senha-n106');
    expect(await screen.findByText(/Nenhuma sala disponível e compatível/)).toBeInTheDocument();
    expect(confirmar()).toBeDisabled();
    expect(confirmar()).toHaveAccessibleDescription('Escolha sala para confirmar.');

    await usuario.click(screen.getByRole('button', { name: 'Manter aguardando recurso' }));
    const modal = await screen.findByRole('dialog', {
      name: /Manter a senha N106 aguardando recurso/,
    });
    expect(within(modal).getByLabelText('Recurso faltante')).toHaveValue('SALA');
    await usuario.click(within(modal).getByRole('button', { name: 'Manter aguardando' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/fila'));
  });

  it('senha que não pode ser alocada mostra a causa e o caminho de volta', async () => {
    abrir('senha-f015');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não está chamada nem aguardando recurso/,
    );
    expect(screen.getByRole('link', { name: 'Voltar à fila' })).toHaveAttribute('href', '/fila');
  });

  it('sem alocacao:criar mostra o estado neutro de sem permissão', () => {
    abrir('senha-f013', ['fila:consultar']);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
  });
});
