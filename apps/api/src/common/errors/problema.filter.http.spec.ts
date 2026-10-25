import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { type Meta, ParametrosPaginacao, type ProblemaValidacao } from '@filas/contracts';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { montarRespostaPaginada } from '../pagination/paginacao';
import { criarAppDeTeste, type AppDeTeste } from '../testing/criar-app-de-teste';
import { ZodValidationPipe } from '../validation/zod-validation.pipe';
import { ErroDominio } from './erro-dominio';

const EntradaTeste = z.object({
  nome: z.string({ error: 'Informe o nome.' }).min(1, { error: 'Informe o nome.' }),
  idade: z.number({ error: 'Informe a idade.' }).int().optional(),
});

@Controller('teste')
class TesteController {
  @Post('validacao')
  validar(@Body(new ZodValidationPipe(EntradaTeste)) corpo: z.output<typeof EntradaTeste>) {
    return corpo;
  }

  @Get('lista')
  listar(@Query(new ZodValidationPipe(ParametrosPaginacao)) query: ParametrosPaginacao) {
    return montarRespostaPaginada([{ id: 'a' }], 45, query);
  }

  @Get('dominio')
  dominio(): never {
    throw new ErroDominio('DUPLICIDADE', 409, 'Registro já cadastrado', 'Já existe.', {
      recursoExistenteId: '0190a000-0000-7000-8000-000000000001',
    });
  }

  @Get('prisma')
  prisma(): never {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
  }

  @Get('check')
  check(): never {
    throw new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "23514", message: "new row for relation \\"triagem\\" violates check constraint \\"triagem_urgente_justificativa_check\\"" }',
      { clientVersion: '6.19.3' },
    );
  }

  @Get('inesperado')
  inesperado(): never {
    throw new Error('segredo interno: senha do banco');
  }
}

type CorpoTeste = Partial<ProblemaValidacao> & { meta?: Meta; recursoExistenteId?: string };

const corpoDe = (resposta: { body: unknown }): CorpoTeste => resposta.body as CorpoTeste;

describe('ProblemaFilter (HTTP)', () => {
  let contexto: AppDeTeste;
  const logErro = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  beforeAll(async () => {
    contexto = await criarAppDeTeste(
      { controllers: [TesteController] },
      { origensCors: ['http://localhost:3000'] },
    );
  });

  afterAll(async () => {
    await contexto.app.close();
  });

  it('erro de validação vira 422 VALIDACAO com campos em português', async () => {
    const resposta = await request(contexto.servidor)
      .post('/api/v1/teste/validacao')
      .send({ idade: 'dez' })
      .expect(422);

    expect(resposta.headers['content-type']).toContain('application/problem+json');
    expect(resposta.body).toMatchObject({ status: 422, codigo: 'VALIDACAO' });
    expect(corpoDe(resposta).campos).toEqual([
      { campo: 'nome', mensagem: 'Informe o nome.' },
      { campo: 'idade', mensagem: 'Informe a idade.' },
    ]);
  });

  it('JSON malformado vira 400 CORPO_INVALIDO, e não 500', async () => {
    const resposta = await request(contexto.servidor)
      .post('/api/v1/teste/validacao')
      .set('Content-Type', 'application/json')
      .send('{"nome":')
      .expect(400);

    expect(resposta.body).toMatchObject({ status: 400, codigo: 'CORPO_INVALIDO' });
  });

  it('ErroDominio mantém código, status e extras', async () => {
    const resposta = await request(contexto.servidor).get('/api/v1/teste/dominio').expect(409);

    expect(resposta.body).toMatchObject({
      codigo: 'DUPLICIDADE',
      title: 'Registro já cadastrado',
      detail: 'Já existe.',
      instance: '/api/v1/teste/dominio',
      recursoExistenteId: '0190a000-0000-7000-8000-000000000001',
    });
  });

  it('P2002 do Prisma vira 409 DUPLICIDADE', async () => {
    const resposta = await request(contexto.servidor).get('/api/v1/teste/prisma').expect(409);

    expect(corpoDe(resposta).codigo).toBe('DUPLICIDADE');
  });

  it('RN-03 CHECK violado no banco vira 422 VALIDACAO com o campo, e não 500', async () => {
    const resposta = await request(contexto.servidor).get('/api/v1/teste/check').expect(422);

    expect(corpoDe(resposta)).toMatchObject({
      codigo: 'VALIDACAO',
      campos: [{ campo: 'justificativaClinica' }],
    });
  });

  it('exceção inesperada vira 500 genérico sem vazar a mensagem, e a stack vai para o log', async () => {
    const resposta = await request(contexto.servidor)
      .get('/api/v1/teste/inesperado')
      .set('X-Request-Id', 'req-500')
      .expect(500);

    expect(corpoDe(resposta).codigo).toBe('ERRO_INTERNO');
    expect(JSON.stringify(resposta.body)).not.toContain('segredo');
    expect(resposta.headers['x-request-id']).toBe('req-500');
    const [contextoLog, mensagem] = logErro.mock.calls[0] as [
      { requestId: string; err: unknown },
      string,
    ];
    expect(contextoLog.requestId).toBe('req-500');
    expect(contextoLog.err).toBeInstanceOf(Error);
    expect(mensagem).toBe('Erro inesperado na requisição');
  });

  it('rota inexistente vira 404 NAO_ENCONTRADO em problem+json, com X-Request-Id', async () => {
    const resposta = await request(contexto.servidor).get('/api/v1/nao-existe').expect(404);

    expect(resposta.headers['content-type']).toContain('application/problem+json');
    expect(corpoDe(resposta).codigo).toBe('NAO_ENCONTRADO');
    expect(resposta.headers['x-request-id']).toBeTruthy();
  });

  describe('paginação', () => {
    it('usa os padrões e devolve dados e meta', async () => {
      const resposta = await request(contexto.servidor).get('/api/v1/teste/lista').expect(200);

      expect(corpoDe(resposta).meta).toEqual({
        pagina: 1,
        tamanho: 20,
        total: 45,
        totalPaginas: 3,
      });
    });

    it('tamanho acima de 100 é recusado com 422', async () => {
      const resposta = await request(contexto.servidor)
        .get('/api/v1/teste/lista?tamanho=101')
        .expect(422);

      expect(corpoDe(resposta).campos).toEqual([
        { campo: 'tamanho', mensagem: 'tamanho deve ser no máximo 100.' },
      ]);
    });
  });

  describe('CORS', () => {
    it('libera a origem do web com credenciais', async () => {
      const resposta = await request(contexto.servidor)
        .options('/api/v1/teste/lista')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(resposta.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(resposta.headers['access-control-allow-credentials']).toBe('true');
    });

    it('não libera origem desconhecida', async () => {
      const resposta = await request(contexto.servidor)
        .get('/api/v1/teste/lista')
        .set('Origin', 'http://malicioso.invalid');

      expect(resposta.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
