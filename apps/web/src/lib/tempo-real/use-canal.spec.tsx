import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessaoProvider } from '@/lib/sessao/sessao';

import { RECONEXAO_MS, useCanalTempoReal } from './use-canal';

const socketFalso = vi.hoisted(() => {
  const ouvintes = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    active: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on(evento: string, ouvinte: (...args: unknown[]) => void) {
      ouvintes.set(evento, [...(ouvintes.get(evento) ?? []), ouvinte]);
    },
    emitir(evento: string, ...args: unknown[]) {
      for (const ouvinte of ouvintes.get(evento) ?? []) ouvinte(...args);
    },
    limpar() {
      ouvintes.clear();
    },
  };
});
const io = vi.hoisted(() => vi.fn(() => socketFalso));
vi.mock('socket.io-client', () => ({ io }));

const queryClient = new QueryClient();
const envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SessaoProvider baseUrl="http://api.invalid">{children}</SessaoProvider>
  </QueryClientProvider>
);

function abrir(opcoes: Partial<Parameters<typeof useCanalTempoReal>[0]> = {}) {
  return renderHook(
    () => useCanalTempoReal({ namespace: '/alertas', ativo: true, eventos: {}, ...opcoes }),
    { wrapper: envoltorio },
  );
}

describe('useCanalTempoReal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    socketFalso.active = true;
    socketFalso.limpar();
    socketFalso.connect.mockClear();
    socketFalso.disconnect.mockClear();
    io.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('não conecta enquanto o canal estiver inativo e a tela segue conectada', () => {
    const { result } = abrir({ ativo: false });
    expect(io).not.toHaveBeenCalled();
    expect(result.current.conectado).toBe(true);
  });

  it('entrega o corpo do evento e chama aoConectar a cada conexão', () => {
    const aoEvento = vi.fn();
    const aoConectar = vi.fn();
    abrir({ eventos: { 'sla.excedido': aoEvento }, aoConectar });

    act(() => socketFalso.emitir('connect'));
    act(() => socketFalso.emitir('sla.excedido', { id: 'a1' }));

    expect(aoConectar).toHaveBeenCalledTimes(1);
    expect(aoEvento).toHaveBeenCalledWith({ id: 'a1' });
  });

  it('RNF-04: encerrada pelo servidor (token expirado), tenta de novo até reconectar', () => {
    const { result } = abrir();

    act(() => socketFalso.emitir('disconnect', 'io server disconnect'));
    expect(result.current.conectado).toBe(false);
    expect(socketFalso.connect).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(RECONEXAO_MS));
    expect(socketFalso.connect).toHaveBeenCalledTimes(1);

    socketFalso.active = false;
    act(() => socketFalso.emitir('connect_error', new Error('CONEXAO_NAO_AUTORIZADA')));
    act(() => void vi.advanceTimersByTime(RECONEXAO_MS));
    expect(socketFalso.connect).toHaveBeenCalledTimes(2);

    act(() => socketFalso.emitir('connect'));
    expect(result.current.conectado).toBe(true);
  });

  it('queda de rede fica com a reconexão automática do próprio socket', () => {
    const { result } = abrir();

    act(() => socketFalso.emitir('disconnect', 'transport close'));
    act(() => socketFalso.emitir('connect_error', new Error('sem rede')));
    act(() => void vi.advanceTimersByTime(RECONEXAO_MS));

    expect(result.current.conectado).toBe(false);
    expect(socketFalso.connect).not.toHaveBeenCalled();
  });

  it('ao sair da tela, desconecta e cancela a nova tentativa', () => {
    const { unmount } = abrir();
    act(() => socketFalso.emitir('disconnect', 'io server disconnect'));

    unmount();
    vi.advanceTimersByTime(RECONEXAO_MS);

    expect(socketFalso.disconnect).toHaveBeenCalledTimes(1);
    expect(socketFalso.connect).not.toHaveBeenCalled();
  });
});
