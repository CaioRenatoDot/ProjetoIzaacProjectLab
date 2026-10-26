import { type Desfecho } from '@filas/contracts';
import { PermissoesProvider } from '@filas/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { atendimentoDaSimulacao } from '@/mocks/atendimentos';
import { senhasDaSimulacao } from '@/mocks/filas';
import { comSessaoAnterior, renderizarComSessao, usarServidorMock } from '@/test/servidor-mock';

import { TelaEncaminhamento } from './tela-encaminhamento';

usarServidorMock();

/** N107 (Nutrição) na simulação do atendimento. */
const ATENDIMENTO = 'atendimento-simulado-2';
const ESTUDANTE = ['encaminhamento:criar', 'atendimento:consultar_sensivel', 'fila:consultar'];

function abrir(desfecho: Desfecho | null, permissoes = ESTUDANTE) {
  atendimentoDaSimulacao(ATENDIMENTO)!.atendimento.desfecho = desfecho;
  comSessaoAnterior();
  renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <TelaEncaminhamento atendimentoId={ATENDIMENTO} />
    </PermissoesProvider>,
  );
  return userEvent.setup();
}

const confirmar = () => screen.getByRole('button', { name: 'Confirmar encaminhamento' });
const especialidade = () => screen.findByLabelText('Especialidade de destino (obrigatório)');

describe('<TelaEncaminhamento> (W-14 / T-14)', () => {
  it('interno válido: mostra o número da nova senha e a fila de destino, anunciados', async () => {
    const usuario = abrir('ENCAMINHAMENTO_INTERNO');
    expect(
      await screen.findByRole('heading', { name: 'Encaminhamento interno' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Atendimento de origem: N107 · Nutrição/)).toBeInTheDocument();

    await usuario.selectOptions(await especialidade(), 'Fisioterapia');
    await usuario.type(screen.getByLabelText(/Motivo do encaminhamento/), 'Dor lombar persistente');
    await usuario.selectOptions(screen.getByLabelText(/Prioridade sugerida/), 'PREFERENCIAL');
    await usuario.click(confirmar());

    const status = await screen.findByText(
      'Encaminhamento registrado. Nova senha F019 na fila de Fisioterapia.',
    );
    expect(status.closest('[aria-live="polite"]')).toBeInTheDocument();
    const nova = senhasDaSimulacao().find((s) => s.numero === 'F019');
    expect(nova).toMatchObject({ status: 'AGUARDANDO', prioridade: 'PREFERENCIAL' });
    expect(
      screen.queryByRole('button', { name: 'Confirmar encaminhamento' }),
    ).not.toBeInTheDocument();
  });

  it('interno sem especialidade é bloqueado com a mensagem abaixo do campo', async () => {
    const usuario = abrir('ENCAMINHAMENTO_INTERNO');
    const campo = await especialidade();
    await usuario.click(confirmar());
    expect(campo).toHaveAccessibleDescription('Escolha a especialidade de destino.');
    await waitFor(() => expect(campo).toHaveFocus());
  });

  it('destino com chamadas bloqueadas avisa e o encaminhamento continua permitido (RN-10)', async () => {
    const usuario = abrir('ENCAMINHAMENTO_INTERNO');
    await usuario.selectOptions(await especialidade(), 'especialidade-2');
    expect(screen.getByText(/Fonoaudiologia está com as chamadas suspensas/)).toBeInTheDocument();
    expect(screen.getByText(/O encaminhamento continua permitido/)).toBeInTheDocument();

    await usuario.click(confirmar());
    expect(
      await screen.findByText(
        'Encaminhamento registrado. Nova senha O203 na fila de Fonoaudiologia.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/a chamada da nova senha fica suspensa/)).toBeInTheDocument();
  });

  it('409 ESPECIALIDADE_INATIVA impede o envio com mensagem explícita e tira o destino da lista', async () => {
    const usuario = abrir('ENCAMINHAMENTO_INTERNO');
    await usuario.selectOptions(await especialidade(), 'Psicologia');
    await usuario.click(confirmar());

    const campo = await especialidade();
    await waitFor(() =>
      expect(campo).toHaveAccessibleDescription(/Psicologia acabou de ser inativada/),
    );
    await waitFor(() =>
      expect(within(campo).queryByRole('option', { name: 'Psicologia' })).not.toBeInTheDocument(),
    );
    expect(senhasDaSimulacao().some((s) => s.numero.startsWith('P'))).toBe(false);
  });

  it('externo sem instituição é bloqueado com a mensagem abaixo do campo', async () => {
    const usuario = abrir('ENCAMINHAMENTO_EXTERNO');
    expect(
      await screen.findByRole('heading', { name: 'Encaminhamento externo' }),
    ).toBeInTheDocument();
    await usuario.type(screen.getByLabelText('Motivo (obrigatório)'), 'Avaliação ortopédica');
    await usuario.click(confirmar());

    const instituicao = screen.getByLabelText('Instituição ou serviço de destino (obrigatório)');
    expect(instituicao).toHaveAccessibleDescription('Informe a instituição ou o serviço.');
    await waitFor(() => expect(instituicao).toHaveFocus());
  });

  it('externo válido é registrado sem gerar entrada de fila', async () => {
    const usuario = abrir('ENCAMINHAMENTO_EXTERNO');
    const antes = senhasDaSimulacao().length;
    await usuario.type(
      await screen.findByLabelText('Instituição ou serviço de destino (obrigatório)'),
      'Hospital Universitário (fictício)',
    );
    await usuario.type(screen.getByLabelText('Motivo (obrigatório)'), 'Avaliação ortopédica');
    await usuario.click(confirmar());
    expect(
      await screen.findByText(
        'Encaminhamento externo para Hospital Universitário (fictício) registrado, sem gerar entrada de fila.',
      ),
    ).toBeInTheDocument();
    expect(senhasDaSimulacao()).toHaveLength(antes);
  });

  it('desfecho que não é encaminhamento explica e volta ao atendimento', async () => {
    abrir('ALTA');
    expect(await screen.findByRole('alert')).toHaveTextContent(/não é um encaminhamento/);
    expect(screen.getByRole('link', { name: 'Voltar ao atendimento' })).toHaveAttribute(
      'href',
      '/atendimento?senha=senha-n107',
    );
  });

  it('sem encaminhamento:criar mostra o estado neutro de sem permissão', () => {
    abrir('ENCAMINHAMENTO_INTERNO', ['encaminhamento:consultar']);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
  });
});
