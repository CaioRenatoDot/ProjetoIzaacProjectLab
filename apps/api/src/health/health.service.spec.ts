import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HealthRepository } from './health.repository';
import { HealthService, TIMEOUT_PING_BANCO_MS } from './health.service';

describe('HealthService', () => {
  const pingBanco = vi.fn<() => Promise<void>>();
  const service = new HealthService({ pingBanco } as unknown as HealthRepository);

  beforeEach(() => {
    pingBanco.mockReset();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('considera o banco disponível quando o SELECT 1 responde', async () => {
    pingBanco.mockResolvedValue(undefined);

    await expect(service.bancoDisponivel()).resolves.toBe(true);
  });

  it('considera o banco indisponível quando a consulta falha', async () => {
    pingBanco.mockRejectedValue(new Error("Can't reach database server"));

    await expect(service.bancoDisponivel()).resolves.toBe(false);
  });

  it('considera o banco indisponível quando a consulta passa do tempo limite', async () => {
    vi.useFakeTimers();
    pingBanco.mockReturnValue(new Promise(() => undefined));

    const resultado = service.bancoDisponivel();
    await vi.advanceTimersByTimeAsync(TIMEOUT_PING_BANCO_MS);

    await expect(resultado).resolves.toBe(false);
  });
});
