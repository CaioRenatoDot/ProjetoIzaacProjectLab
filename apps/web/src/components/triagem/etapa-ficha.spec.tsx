import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EtapaFicha } from './etapa-ficha';
import { criarTriagemApiEmMemoria } from '@/lib/triagem/api-em-memoria';
import { type PacienteBusca } from '@/lib/triagem/tipos';
import { renderizar } from '@/test/renderizar';

const paciente: PacienteBusca = {
  id: 'pac-1',
  iniciais: 'M. A. S.',
  documento: '12345678900',
  vinculo: 'EXTERNO',
  restricaoAtiva: false,
  restricaoAte: null,
};

const comRestricao: PacienteBusca = {
  ...paciente,
  id: 'pac-2',
  restricaoAtiva: true,
  restricaoAte: '2026-11-30',
};

async function abrir(p: PacienteBusca = paciente, onConcluir = vi.fn()) {
  const usuario = userEvent.setup();
  renderizar(
    <EtapaFicha
      api={criarTriagemApiEmMemoria()}
      paciente={p}
      onTrocarPaciente={vi.fn()}
      onConcluir={onConcluir}
    />,
    ['triagem:criar'],
  );
  await screen.findByLabelText(/Especialidade de destino/);
  return { usuario, onConcluir };
}

describe('EtapaFicha (W-06)', () => {
  it('RN-03: prioridade Urgente sem justificativa clínica bloqueia o envio com a mensagem abaixo do campo', async () => {
    const { usuario, onConcluir } = await abrir();
    await usuario.selectOptions(screen.getByLabelText(/Especialidade de destino/), 'esp-fisio');
    await usuario.type(screen.getByLabelText(/Motivo do atendimento/), 'Dor aguda');
    await usuario.selectOptions(screen.getByLabelText(/^Prioridade/), 'URGENTE');

    await usuario.click(screen.getByRole('button', { name: 'Concluir triagem' }));

    const campo = await screen.findByLabelText(/Justificativa clínica/);
    expect(screen.getByText('Justificativa é obrigatória para prioridade Urgente.')).toBeVisible();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(campo).toHaveFocus());
    expect(onConcluir).not.toHaveBeenCalled();
  });

  it('RN-03: com justificativa clínica a triagem é concluída', async () => {
    const { usuario, onConcluir } = await abrir();
    await usuario.selectOptions(screen.getByLabelText(/Especialidade de destino/), 'esp-fisio');
    await usuario.type(screen.getByLabelText(/Motivo do atendimento/), 'Dor aguda');
    await usuario.selectOptions(screen.getByLabelText(/^Prioridade/), 'URGENTE');
    await usuario.type(screen.getByLabelText(/Justificativa clínica/), 'Risco de agravamento');

    await usuario.click(screen.getByRole('button', { name: 'Concluir triagem' }));

    await waitFor(() => expect(onConcluir).toHaveBeenCalledTimes(1));
    expect(onConcluir.mock.calls[0]?.[0]).toMatchObject({ prioridade: 'URGENTE' });
  });

  it('RN-02: enquadramento legal "Idoso" marca Preferencial e anuncia o aviso', async () => {
    const { usuario } = await abrir();
    const prioridade = screen.getByLabelText(/^Prioridade/);
    expect(prioridade).toHaveValue('NORMAL');

    await usuario.selectOptions(screen.getByLabelText('Enquadramento legal'), 'IDOSO');

    expect(prioridade).toHaveValue('PREFERENCIAL');
    const aviso = screen.getByText(
      'Enquadramento legal informado: a prioridade foi marcada como Preferencial.',
    );
    expect(aviso).toBeVisible();
    // A região viva existe antes do aviso, por isso o leitor de tela o anuncia ao aparecer.
    expect(aviso.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Normal' })).toBeDisabled();
  });

  it('só oferece especialidades ativas com fila configurada', async () => {
    await abrir();
    const opcoes = screen
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter((t) =>
        ['Fisioterapia', 'Psicologia', 'Nutrição', 'Fonoaudiologia'].includes(t ?? ''),
      );
    expect(opcoes).toEqual(['Fisioterapia', 'Psicologia', 'Nutrição']);
  });

  it('RN-13: paciente com restrição mostra o banner e a triagem continua permitida', async () => {
    await abrir(comRestricao);
    expect(screen.getByText('Paciente com restrição por ausências repetidas.')).toBeVisible();
    expect(screen.getByText(/A triagem continua permitida/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Concluir triagem' })).toBeEnabled();
  });

  it('aviso de consulta registrada aparece na primeira abertura da sessão e não se repete', async () => {
    await abrir();
    expect(
      screen.getByText('Consultas a dados clínicos ficam registradas na trilha de auditoria.'),
    ).toBeVisible();

    document.body.innerHTML = '';
    await abrir();
    expect(
      screen.queryByText('Consultas a dados clínicos ficam registradas na trilha de auditoria.'),
    ).toBeNull();
  });

  it('a mudança de etapa leva o foco para o título', async () => {
    await abrir();
    expect(screen.getByRole('heading', { name: /Triagem: ficha de M\. A\. S\./ })).toHaveFocus();
  });
});
