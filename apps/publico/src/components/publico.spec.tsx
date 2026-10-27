import { act, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type EstadoPainel,
  type EventosPainel,
  type FontePublica,
  ErroPublico,
} from '../lib/publico';
import { Consulta } from './consulta';
import { Telao } from './telao';

const atual = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03', sequencia: 1 };
function prepararFonte() {
  let eventos!: EventosPainel;
  const cancelar = vi.fn();
  const fonte: FontePublica = {
    estado: vi.fn().mockResolvedValue({ atual, anteriores: [] }),
    consultar: vi.fn().mockResolvedValue({
      numero: 'F015',
      especialidade: 'Fisioterapia',
      status: 'AGUARDANDO',
      posicao: 4,
      tempoEstimadoMinutos: 22,
      local: null,
    }),
    conectar: vi.fn((e: EventosPainel) => {
      eventos = e;
      return cancelar;
    }),
  };
  return { fonte, cancelar, eventos: () => eventos };
}
afterEach(() => vi.useRealTimers());

describe('telão W-09', () => {
  it('nova chamada anuncia em aria-live assertivo e move a anterior; rechamada não duplica', async () => {
    const f = prepararFonte();
    render(<Telao fonte={f.fonte} unidade="Clínica-Escola" />);
    await screen.findByRole('heading', { name: 'F014' });
    act(() => f.eventos().chamada({ ...atual, numero: 'F015' }));
    expect(screen.getByRole('heading', { name: 'F015' })).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Chamadas anteriores' })).getByText('F014'),
    ).toBeVisible();
    expect(screen.getByText(/Senha F015\./)).toHaveAttribute('aria-live', 'assertive');
    act(() => f.eventos().chamada({ ...atual, numero: 'F015', sequencia: 2 }));
    expect(screen.getByText(/Chamada 2\./)).toBeInTheDocument();
    expect(screen.getAllByText('F014')).toHaveLength(1);
  });

  it('queda mantém a última chamada e reconexão reconstrói a lista com painel.estado', async () => {
    const f = prepararFonte();
    render(<Telao fonte={f.fonte} unidade="Clínica-Escola" />);
    await screen.findByRole('heading', { name: 'F014' });
    act(() => f.eventos().conexao(false));
    expect(screen.getByText(/Conexão interrompida/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'F014' })).toBeVisible();
    act(() => f.eventos().estado({ atual: { ...atual, numero: 'F030' }, anteriores: [atual] }));
    expect(screen.getByRole('heading', { name: 'F030' })).toBeVisible();
  });

  it('resposta HTTP atrasada não substitui chamada mais recente recebida pelo evento', async () => {
    const f = prepararFonte();
    let concluir!: (estado: EstadoPainel) => void;
    vi.mocked(f.fonte.estado).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          concluir = resolve;
        }),
    );
    render(<Telao fonte={f.fonte} unidade="Clínica-Escola" />);
    act(() => f.eventos().chamada({ ...atual, numero: 'F016' }));
    await act(async () => {
      concluir({ atual, anteriores: [] });
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: 'F016' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'F014' })).not.toBeInTheDocument();
  });

  it('sem chamadas mostra mensagem neutra e relógio; desmontagem encerra conexão', async () => {
    const f = prepararFonte();
    vi.mocked(f.fonte.estado).mockResolvedValue({ atual: null, anteriores: [] });
    const { unmount } = render(<Telao fonte={f.fonte} unidade="Clínica-Escola" />);
    expect(await screen.findByText('Aguardando próximas chamadas')).toBeVisible();
    expect(screen.getByLabelText('Horário atual')).toBeVisible();
    unmount();
    expect(f.cancelar).toHaveBeenCalledOnce();
  });
});

describe('consulta W-10', () => {
  it('consulta mostra posição e estimativa, sem pedir login', async () => {
    const f = prepararFonte();
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'f015');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('heading', { name: 'F015' })).toBeVisible();
    expect(screen.getByText('4ª')).toBeVisible();
    expect(screen.getByText('~22 min')).toBeVisible();
    expect(f.fonte.consultar).toHaveBeenCalledWith('F015', expect.any(AbortSignal));
  });

  it('senha inexistente apresenta mensagem neutra, mesmo com detalhe de erro desconhecido', async () => {
    const f = prepararFonte();
    vi.mocked(f.fonte.consultar).mockRejectedValue(new ErroPublico(404));
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'F999');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não localizamos essa senha para o dia de hoje. Procure a recepção.',
    );
  });

  it.each(['AUSENTE', 'DESISTENCIA'] as const)('%s orienta procurar a recepção', async (status) => {
    const f = prepararFonte();
    vi.mocked(f.fonte.consultar).mockResolvedValue({
      numero: 'F021',
      especialidade: 'Fisioterapia',
      status,
      posicao: null,
      tempoEstimadoMinutos: null,
      local: null,
    });
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'F021');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Procure a recepção para orientação.')).toBeVisible();
    expect(screen.queryByText('Tempo estimado')).not.toBeInTheDocument();
  });

  it('sem estimativa mostra só posição e nota explicativa', async () => {
    const f = prepararFonte();
    vi.mocked(f.fonte.consultar).mockResolvedValue({
      numero: 'F020',
      especialidade: 'Fisioterapia',
      status: 'AGUARDANDO',
      posicao: 3,
      tempoEstimadoMinutos: null,
      local: null,
    });
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'F020');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('3ª')).toBeVisible();
    expect(screen.queryByText('Tempo estimado')).not.toBeInTheDocument();
  });

  it('atualiza automaticamente a cada 30 segundos e anuncia mudança da posição', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const f = prepararFonte();
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'F015');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    await waitFor(() => expect(screen.getByText('4ª')).toBeVisible());
    vi.mocked(f.fonte.consultar).mockResolvedValue({
      numero: 'F015',
      especialidade: 'Fisioterapia',
      status: 'AGUARDANDO',
      posicao: 2,
      tempoEstimadoMinutos: 10,
      local: null,
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(screen.getByText('2ª')).toBeVisible();
    expect(screen.getByText('2ª').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('estados de erro e recuperação', () => {
  it('telão apresenta erro com ação de tentar novamente', async () => {
    const f = prepararFonte();
    vi.mocked(f.fonte.estado).mockRejectedValueOnce(new ErroPublico(0));
    const usuario = userEvent.setup();
    render(<Telao fonte={f.fonte} unidade="Clínica-Escola" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as chamadas',
    );
    await usuario.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'F014' })).toBeVisible();
  });

  it('erro de atualização preserva a última posição consultada', async () => {
    const f = prepararFonte();
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'F015');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    await screen.findByText('4ª');
    vi.mocked(f.fonte.consultar).mockRejectedValue(new ErroPublico(0));
    await usuario.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('última atualização disponível');
    expect(screen.getByText('4ª')).toBeVisible();
  });

  it('respeita 429 e mantém orientação de espera ao tentar uma nova consulta', async () => {
    const f = prepararFonte();
    vi.mocked(f.fonte.consultar).mockRejectedValue(new ErroPublico(429, 30));
    const usuario = userEvent.setup();
    render(<Consulta fonte={f.fonte} unidade="Clínica-Escola" />);
    await usuario.type(screen.getByLabelText('Número da senha'), 'F015');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde um pouco');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Aguarde um pouco');
    expect(f.fonte.consultar).toHaveBeenCalledOnce();
  });
});
