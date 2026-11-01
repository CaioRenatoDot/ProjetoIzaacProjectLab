import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { EventosPainel, FontePublica } from '../lib/publico';
import { Telao } from './telao';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

it('RNF-06: chamada e rechamada acompanham destaque; snapshot e duplicata não tocam', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const add = vi.spyOn(HTMLMediaElement.prototype, 'addEventListener');
  let eventos!: EventosPainel;
  const chamada = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03', sequencia: 1 };
  const fonte: FontePublica = {
    estado: () => Promise.resolve({ atual: chamada, anteriores: [] }),
    consultar: vi.fn(),
    conectar: (e) => {
      eventos = e;
      return () => {};
    },
  };
  render(<Telao fonte={fonte} unidade="Clínica-Escola" />);
  await screen.findByRole('heading', { name: 'F014' });
  expect(play).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Ativar som' }));
  expect(await screen.findByText('Som ativado.')).toBeVisible();
  const audio = add.mock.instances[0] as HTMLAudioElement;
  act(() => {
    audio.dispatchEvent(new Event('ended'));
  });
  act(() => eventos.chamada({ ...chamada, numero: 'F015' }));
  expect(play).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('region', { name: 'Chamada atual' })).toHaveAttribute(
    'data-destaque',
    'true',
  );
  act(() => {
    audio.dispatchEvent(new Event('ended'));
  });
  act(() => eventos.chamada({ ...chamada, numero: 'F015', sequencia: 2 }));
  expect(play).toHaveBeenCalledTimes(3);
  act(() => eventos.chamada({ ...chamada, numero: 'F015', sequencia: 2 }));
  act(() => eventos.estado({ atual: chamada, anteriores: [] }));
  expect(play).toHaveBeenCalledTimes(3);
  await userEvent.click(screen.getByRole('button', { name: 'Desativar som' }));
  act(() => eventos.chamada({ ...chamada, numero: 'F016' }));
  expect(screen.getByRole('heading', { name: 'F016' })).toBeVisible();
  expect(play).toHaveBeenCalledTimes(3);
});

it('RNF-06: configuração desligada mantém chamada visual e aria-live', async () => {
  window.history.replaceState(null, '', '/telao?som=0');
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
  let eventos!: EventosPainel;
  const fonte: FontePublica = {
    estado: () => Promise.resolve({ atual: null, anteriores: [] }),
    consultar: vi.fn(),
    conectar: (e) => {
      eventos = e;
      return () => {};
    },
  };
  render(<Telao fonte={fonte} unidade="Clínica-Escola" />);
  await screen.findByText('Som desativado na configuração.');
  act(() =>
    eventos.chamada({
      numero: 'F050',
      especialidade: 'Fisioterapia',
      local: 'Sala 01',
      sequencia: 1,
    }),
  );
  expect(screen.getByRole('heading', { name: 'F050' })).toBeVisible();
  expect(screen.getByText(/Senha F050\./)).toHaveAttribute('aria-live', 'assertive');
  expect(screen.queryByRole('button', { name: 'Ativar som' })).not.toBeInTheDocument();
  expect(play).not.toHaveBeenCalled();
});
