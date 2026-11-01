import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EtapaSenha } from './etapa-senha';
import { criarTriagemApiEmMemoria } from '@/lib/triagem/api-em-memoria';
import { type TriagemApi, type TriagemRegistrada } from '@/lib/triagem/tipos';
import { renderizar } from '@/test/renderizar';

async function triagemRegistrada(api: TriagemApi, especialidadeDestinoId = 'esp-fisio') {
  return api.registrarTriagem({
    pacienteId: 'pac-1',
    especialidadeDestinoId,
    tipoAtendimento: 'PRIMEIRA_CONSULTA',
    prioridade: 'NORMAL',
    motivo: 'Dor lombar',
  });
}

function abrir(api: TriagemApi, triagem: TriagemRegistrada, permissoes: string[] = []) {
  renderizar(<EtapaSenha api={api} triagem={triagem} onNovaTriagem={vi.fn()} />, permissoes);
  return userEvent.setup();
}

describe('EtapaSenha (W-07)', () => {
  it('mostra o resumo sem o motivo clínico (P-03)', async () => {
    const api = criarTriagemApiEmMemoria();
    abrir(api, await triagemRegistrada(api));
    expect(screen.getByText('M. A. S.')).toBeVisible();
    expect(screen.getByText('Fisioterapia')).toBeVisible();
    expect(screen.queryByText(/Dor lombar/)).toBeNull();
  });

  it('emite a senha em destaque, anunciada por aria-live', async () => {
    const api = criarTriagemApiEmMemoria();
    const usuario = abrir(api, await triagemRegistrada(api));

    await usuario.click(screen.getByRole('button', { name: 'Confirmar emissão' }));

    const numero = await screen.findByLabelText(/^Senha [A-Z]\d{3}$/);
    expect(numero.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/Posição estimada na fila: 3/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Imprimir senha' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nova triagem' })).toBeVisible();
  });

  it('SEM_FILA_CONFIGURADA bloqueia a emissão, explica a causa e orienta o próximo passo', async () => {
    const api = criarTriagemApiEmMemoria({ especialidadesSemFilaNaEmissao: ['esp-fisio'] });
    const usuario = abrir(api, await triagemRegistrada(api));

    await usuario.click(screen.getByRole('button', { name: 'Confirmar emissão' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('A senha não pôde ser emitida.');
    expect(alerta).toHaveTextContent('não tem fila ativa');
    expect(alerta).toHaveTextContent('Peça à administração');
    expect(screen.getByRole('button', { name: 'Confirmar emissão' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Imprimir senha' })).toBeNull();
  });

  it('RN-10: especialidade bloqueada por falta de supervisor emite e avisa que a chamada está suspensa', async () => {
    const api = criarTriagemApiEmMemoria();
    const usuario = abrir(api, await triagemRegistrada(api, 'esp-psico'));

    await usuario.click(screen.getByRole('button', { name: 'Confirmar emissão' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'chamada desta especialidade está suspensa',
    );
    expect(screen.getByLabelText(/^Senha [A-Z]\d{3}$/)).toBeVisible();
  });

  it('só oferece "Reclassificar prioridade" com a permissão senha:reclassificar', async () => {
    const api = criarTriagemApiEmMemoria();
    const triagem = await triagemRegistrada(api);

    abrir(api, triagem);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar emissão' }));
    await screen.findByLabelText(/^Senha [A-Z]\d{3}$/);
    expect(screen.queryByRole('button', { name: 'Reclassificar prioridade' })).toBeNull();
  });
});
