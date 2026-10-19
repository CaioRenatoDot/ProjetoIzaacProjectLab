import { type Server } from 'node:http';

import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { configurarApp } from '../configurar-app';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { HealthModule } from './health.module';

// Integração HTTP com a mesma configuração do main.ts (prefixo e X-Request-Id),
// trocando apenas o PrismaService por um dublê para não depender do banco.
describe('Health (HTTP)', () => {
  const queryRaw = vi.fn<() => Promise<unknown>>();
  let app: INestApplication;
  let servidor: Server;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const modulo = await Test.createTestingModule({ imports: [PrismaModule, HealthModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = modulo.createNestApplication({ logger: false });
    configurarApp(app);
    await app.init();
    servidor = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('GET /api/v1/health responde 200 sem consultar o banco', async () => {
    const resposta = await request(servidor).get('/api/v1/health').expect(200);

    expect(resposta.body).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('GET /api/v1/health/ready responde 200 quando o banco responde', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const resposta = await request(servidor).get('/api/v1/health/ready').expect(200);

    expect(resposta.body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health/ready responde 503 quando o banco está fora', async () => {
    queryRaw.mockRejectedValue(new Error("Can't reach database server"));

    const resposta = await request(servidor).get('/api/v1/health/ready').expect(503);

    expect(resposta.body).toMatchObject({ status: 503, codigo: 'BANCO_INDISPONIVEL' });
  });

  describe('X-Request-Id', () => {
    it('gera um id quando a requisição não traz', async () => {
      const resposta = await request(servidor).get('/api/v1/health');

      expect(resposta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reaproveita o id recebido na requisição', async () => {
      const resposta = await request(servidor)
        .get('/api/v1/health')
        .set('X-Request-Id', 'abc-123');

      expect(resposta.headers['x-request-id']).toBe('abc-123');
    });

    it('descarta id recebido em formato inválido', async () => {
      const resposta = await request(servidor)
        .get('/api/v1/health')
        .set('X-Request-Id', 'x'.repeat(200));

      expect(resposta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('está presente também em resposta de erro e em rota inexistente', async () => {
      queryRaw.mockRejectedValue(new Error('fora'));

      const erro = await request(servidor).get('/api/v1/health/ready').expect(503);
      const naoEncontrado = await request(servidor).get('/api/v1/nao-existe').expect(404);

      expect(erro.headers['x-request-id']).toBeDefined();
      expect(naoEncontrado.headers['x-request-id']).toBeDefined();
    });
  });
});
