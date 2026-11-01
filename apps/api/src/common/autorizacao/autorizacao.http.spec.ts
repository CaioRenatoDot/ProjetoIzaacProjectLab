import { Body, Controller, Get, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { type Problema } from '@filas/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../auth/auth.service';
import { type UsuarioAutenticado } from '../../auth/usuario-autenticado';
import { AuditoriaInterceptor } from '../auditoria/auditoria.interceptor';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { criarAppDeTeste, type AppDeTeste } from '../testing/criar-app-de-teste';
import { Autenticado, LeituraSensivel, Publico, Requer } from './decorators';
import { PermissaoGuard } from './permissao.guard';

const ID = '0190a000-0000-7000-8000-0000000000aa';

@Controller('teste')
class TesteController {
  @Get('sem-decorator')
  semDecorator() {
    return { ok: true };
  }

  @Get('publico')
  @Publico()
  publico() {
    return { ok: true };
  }

  @Get('autenticado')
  @Autenticado()
  autenticado() {
    return { ok: true };
  }

  @Get('fila')
  @Requer('fila:consultar')
  consultarFila() {
    return { ok: true };
  }

  @Get('fila/:id')
  @Requer('fila:excluir')
  inexistente(): never {
    throw new NotFoundException();
  }

  @Post('fila')
  @Requer('fila:criar')
  criarFila(@Body() _corpo: unknown) {
    return { id: ID };
  }

  @Get('triagens/:id')
  @Requer('triagem:consultar_sensivel')
  @LeituraSensivel()
  consultarTriagem(@Param('id') id: string) {
    return { id, motivo: 'dado clinico ficticio' };
  }
}

@Controller('aberto')
@Publico()
class ClassePublicaController {
  @Get('livre')
  livre() {
    return { ok: true };
  }

  @Get('protegido')
  @Requer('auditoria:consultar')
  protegido() {
    return { ok: true };
  }
}

const usuario: UsuarioAutenticado = {
  id: '0190a000-0000-7000-8000-000000000001',
  nome: 'Usuario',
  perfilId: 'p',
  perfilNome: 'Recepcao',
  unidadeId: 'u',
  unidadeNome: 'Unidade',
  permissoes: ['fila:consultar', 'fila:criar', 'triagem:consultar_sensivel'],
  sessaoId: 's',
};

describe('guard de permissão e auditoria implícita (HTTP)', () => {
  const autenticar = vi.fn();
  const registrar = vi.fn();
  let contexto: AppDeTeste;
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  const comToken = (req: request.Test) => req.set('Authorization', 'Bearer token-valido');

  beforeAll(async () => {
    contexto = await criarAppDeTeste({
      controllers: [TesteController, ClassePublicaController],
      providers: [
        { provide: AuthService, useValue: { autenticar } },
        { provide: AuditoriaService, useValue: { registrar } },
        { provide: APP_GUARD, useClass: PermissaoGuard },
        { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
      ],
    });
  });

  afterAll(async () => {
    await contexto.app.close();
  });

  beforeEach(() => {
    autenticar
      .mockReset()
      .mockImplementation((token: string) =>
        Promise.resolve(token === 'token-valido' ? usuario : null),
      );
    registrar.mockReset().mockResolvedValue(undefined);
  });

  describe('RNF-01: guard', () => {
    it('nega por padrão a rota sem decorator, mesmo com sessão válida', async () => {
      await comToken(request(contexto.servidor).get('/api/v1/teste/sem-decorator')).expect(403);
    });

    it('libera a rota pública sem token', async () => {
      await request(contexto.servidor).get('/api/v1/teste/publico').expect(200);
    });

    it('@Autenticado exige sessão, sem permissão própria', async () => {
      await request(contexto.servidor).get('/api/v1/teste/autenticado').expect(401);
      await comToken(request(contexto.servidor).get('/api/v1/teste/autenticado')).expect(200);
    });

    it('@Requer responde 401 sem token, 403 sem a permissão e 200 com ela', async () => {
      const sem = await request(contexto.servidor).get('/api/v1/teste/fila').expect(401);
      expect((sem.body as Problema).codigo).toBe('NAO_AUTENTICADO');

      await comToken(request(contexto.servidor).get('/api/v1/teste/fila')).expect(200);

      const negado = await comToken(
        request(contexto.servidor).get('/api/v1/aberto/protegido'),
      ).expect(403);
      expect((negado.body as Problema).codigo).toBe('SEM_PERMISSAO');
    });

    it('recurso inexistente sem permissão responde 403, nunca 404', async () => {
      await comToken(request(contexto.servidor).get(`/api/v1/teste/fila/${ID}`)).expect(403);
    });

    it('@Requer no método prevalece sobre @Publico na classe', async () => {
      await request(contexto.servidor).get('/api/v1/aberto/livre').expect(200);
      await request(contexto.servidor).get('/api/v1/aberto/protegido').expect(401);
    });
  });

  describe('RNF-05: auditoria implícita', () => {
    it('grava a escrita autenticada com módulo, operação e id criado', async () => {
      await comToken(request(contexto.servidor).post('/api/v1/teste/fila'))
        .set('X-Request-Id', 'req-audit')
        .send({ justificativa: 'motivo ficticio' })
        .expect(201);

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: usuario.id,
          perfilNomeNoMomento: 'Recepcao',
          operacao: 'CRIAR',
          modulo: 'fila',
          entidadeId: ID,
          justificativa: 'motivo ficticio',
          requestId: 'req-audit',
          sensivel: false,
        }),
      );
    });

    it('não grava leitura comum', async () => {
      await comToken(request(contexto.servidor).get('/api/v1/teste/fila')).expect(200);

      expect(registrar).not.toHaveBeenCalled();
    });

    it('RNF-07 grava CONSULTAR_SENSIVEL na leitura de dado de saúde', async () => {
      await comToken(request(contexto.servidor).get(`/api/v1/teste/triagens/${ID}`)).expect(200);

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({ operacao: 'CONSULTAR_SENSIVEL', sensivel: true, entidadeId: ID }),
      );
    });

    it('RNF-07 não entrega o dado sensível se o registro falhar', async () => {
      registrar.mockRejectedValue(new Error('banco fora'));

      const resposta = await comToken(
        request(contexto.servidor).get(`/api/v1/teste/triagens/${ID}`),
      ).expect(500);

      expect(JSON.stringify(resposta.body)).not.toContain('dado clinico');
    });

    it('não grava requisição negada pelo guard', async () => {
      await request(contexto.servidor).post('/api/v1/teste/fila').expect(401);

      expect(registrar).not.toHaveBeenCalled();
    });
  });
});
