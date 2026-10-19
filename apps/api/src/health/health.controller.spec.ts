import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { statusSaudeSchema } from './dto/status-saude.dto';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  const bancoDisponivel = vi.fn<() => Promise<boolean>>();
  let controller: HealthController;

  beforeEach(async () => {
    bancoDisponivel.mockReset();
    const modulo = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { bancoDisponivel } }],
    }).compile();

    controller = modulo.get(HealthController);
  });

  it('liveness responde ok sem consultar o banco', () => {
    const resposta = controller.liveness();

    expect(statusSaudeSchema.parse(resposta)).toEqual({ status: 'ok' });
    expect(bancoDisponivel).not.toHaveBeenCalled();
  });

  it('readiness responde ok quando o banco responde', async () => {
    bancoDisponivel.mockResolvedValue(true);

    await expect(controller.readiness()).resolves.toEqual({ status: 'ok' });
  });

  it('readiness lança 503 quando o banco não responde', async () => {
    bancoDisponivel.mockResolvedValue(false);

    const erro = await controller.readiness().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ServiceUnavailableException);
    expect((erro as ServiceUnavailableException).getStatus()).toBe(503);
    expect((erro as ServiceUnavailableException).getResponse()).toMatchObject({
      codigo: 'BANCO_INDISPONIVEL',
    });
  });
});
