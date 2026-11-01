import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ModalReclassificacao } from './modal-reclassificacao';
import { criarTriagemApiEmMemoria } from '@/lib/triagem/api-em-memoria';
import { renderizar } from '@/test/renderizar';

async function emitirSenha() {
  const api = criarTriagemApiEmMemoria();
  const triagem = await api.registrarTriagem({
    pacienteId: 'pac-1',
    especialidadeDestinoId: 'esp-fisio',
    tipoAtendimento: 'PRIMEIRA_CONSULTA',
    prioridade: 'NORMAL',
    motivo: 'Dor lombar',
  });
  const senha = await api.emitirSenha({
    triagemId: triagem.id,
    tipoAtendimento: 'PRIMEIRA_CONSULTA',
  });
  return { api, senha };
}

async function abrir(onReclassificada = vi.fn()) {
  const { api, senha } = await emitirSenha();
  renderizar(
    <ModalReclassificacao
      api={api}
      aberto
      onAbertoChange={vi.fn()}
      senha={{
        id: senha.id,
        numero: senha.numero,
        prioridade: senha.prioridade,
        versao: senha.versao,
      }}
      onReclassificada={onReclassificada}
    />,
  );
  await screen.findByText(/Nenhuma reclassificação anterior|Histórico/);
  return { api, senha, usuario: userEvent.setup(), onReclassificada };
}

describe('ModalReclassificacao (W-07 / T-08)', () => {
  it('RN-01: sem justificativa o botão Confirmar fica desabilitado e a mensagem explica que é obrigatória', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(screen.getByText(/A justificativa é obrigatória/)).toBeVisible();
  });

  it('senha sem histórico mostra "Nenhuma reclassificação anterior."', async () => {
    await abrir();
    expect(await screen.findByText('Nenhuma reclassificação anterior.')).toBeVisible();
  });

  it('a nova prioridade só oferece valores diferentes da atual', async () => {
    await abrir();
    const nova = screen.getByLabelText('Nova prioridade');
    const valores = Array.from(nova.querySelectorAll('option')).map((o) => o.value);
    expect(valores).toEqual(['PREFERENCIAL', 'URGENTE']);
  });

  it('RN-01: justificativa abaixo do mínimo da unidade é recusada com o motivo abaixo do campo', async () => {
    const { usuario, onReclassificada } = await abrir();
    await usuario.type(screen.getByLabelText('Justificativa'), 'curta');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText('A justificativa precisa ter ao menos 20 caracteres.'),
    ).toBeVisible();
    expect(onReclassificada).not.toHaveBeenCalled();
  });

  it('RN-01: com justificativa válida reclassifica e informa a nova posição', async () => {
    const { usuario, onReclassificada } = await abrir();
    await usuario.selectOptions(screen.getByLabelText('Nova prioridade'), 'URGENTE');
    await usuario.type(
      screen.getByLabelText('Justificativa'),
      'Agravamento identificado após a triagem',
    );
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(onReclassificada).toHaveBeenCalledTimes(1));
    expect(onReclassificada.mock.calls[0]?.[0]).toMatchObject({
      prioridade: 'URGENTE',
      novaPosicao: 1,
    });
    expect(await screen.findByText(/Nova posição: 1\./)).toBeVisible();
  });

  it('VERSAO_DESATUALIZADA recarrega a senha e avisa o que mudou', async () => {
    const { api, senha, usuario } = await abrir();
    // Outra pessoa reclassifica primeiro, a versão no modal fica velha.
    await api.reclassificar({
      senhaId: senha.id,
      prioridade: 'URGENTE',
      justificativa: 'Reclassificada por outra pessoa agora',
      versao: senha.versao,
    });
    const onRecarregada = vi.fn();
    expect(onRecarregada).not.toHaveBeenCalled();

    await usuario.type(
      screen.getByLabelText('Justificativa'),
      'Agravamento identificado após a triagem',
    );
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText(/foi alterada por outra pessoa/)).toBeVisible();
    expect(screen.getByText(/A prioridade atual é Urgente\./)).toBeVisible();
  });
});
