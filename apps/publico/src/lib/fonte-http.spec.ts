import { afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const eventos = new Map<string, (valor?: unknown) => void>();
  const socket = {
    on: vi.fn((nome: string, callback: (valor?: unknown) => void) => {
      eventos.set(nome, callback);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return { eventos, socket, io: vi.fn(() => socket) };
});
vi.mock('socket.io-client', () => ({ io: mock.io }));

import { criarFonteHttp } from './fonte-http';

const config = {
  apiUrl: 'https://api.exemplo/api/v1',
  socketUrl: 'https://api.exemplo',
  unidadeId: 'unidade/1',
  unidadeNome: 'Clínica',
};
const chamada = { numero: 'F014', especialidade: 'Fisioterapia', local: 'Sala 03', sequencia: 1 };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mock.eventos.clear();
});

describe('transporte público sem autenticação', () => {
  it('usa o endpoint público, sem cookies ou Authorization, e projeta a resposta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          atual: { ...chamada, nomeCompleto: 'DADO_PROIBIDO' },
          anteriores: [],
          prioridade: 'URGENTE',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const estado = await criarFonteHttp(config).estado();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.exemplo/api/v1/publico/painel/unidade%2F1',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
    );
    expect(JSON.stringify(estado)).not.toContain('DADO_PROIBIDO');
    const opcoes = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(opcoes.headers).toEqual({ Accept: 'application/json' });
  });

  it('404 usa a mesma mensagem neutra, sem revelar o detalhe enviado pela API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Senha de ontem de DADO_PROIBIDO' }), {
          status: 404,
        }),
      ),
    );
    await expect(criarFonteHttp(config).consultar('F999')).rejects.toMatchObject({
      status: 404,
      message: 'Não localizamos essa senha para o dia de hoje. Procure a recepção.',
    });
  });

  it('namespace /painel sem auth projeta os dois eventos e encerra o socket no cleanup', () => {
    const eventos = { chamada: vi.fn(), estado: vi.fn(), conexao: vi.fn() };
    const cancelar = criarFonteHttp(config).conectar(eventos);
    expect(mock.io).toHaveBeenCalledWith('https://api.exemplo/painel', {
      autoConnect: false,
      withCredentials: false,
      query: { unidadeId: 'unidade/1' },
    });
    mock.eventos.get('connect')?.();
    mock.eventos.get('chamada.exibir')?.({
      ...chamada,
      nomeCompleto: 'DADO_PROIBIDO',
      prioridade: 'URGENTE',
    });
    expect(eventos.chamada).toHaveBeenCalledWith(chamada);
    mock.eventos.get('painel.estado')?.({ atual: chamada, anteriores: [] });
    expect(eventos.estado).toHaveBeenCalledWith({ atual: chamada, anteriores: [] });
    mock.eventos.get('disconnect')?.();
    expect(eventos.conexao).toHaveBeenNthCalledWith(1, true);
    expect(eventos.conexao).toHaveBeenNthCalledWith(2, false);
    cancelar();
    expect(mock.socket.disconnect).toHaveBeenCalledOnce();
    expect(mock.socket.removeAllListeners).toHaveBeenCalledOnce();
  });
});
