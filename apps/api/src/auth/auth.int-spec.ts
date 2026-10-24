import { ConfigModule } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { type Problema, type ProblemaBloqueio, type UsuarioSessao } from '@filas/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { garantirBancoDeTeste } from '../common/testing/banco-de-teste';
import { criarAppDeTeste, type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { validarAmbiente } from '../config/ambiente';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth.module';
import { gerarHashSenha } from './senha';

const URL_TESTE = garantirBancoDeTeste(process.env.DATABASE_URL_TEST);
const UNIDADE = '01900000-0000-7000-8000-000000000001';
const SENHA = 'senha-ficticia-de-teste';

const prisma = new PrismaClient({ datasourceUrl: URL_TESTE });
let contexto: AppDeTeste;
let perfilId: string;
let hashSenha: string;
let sequencia = 0;

/** Usuário novo por teste, para os contadores de tentativa não se misturarem. */
async function criarUsuario(dados: { ativo?: boolean } = {}): Promise<string> {
  sequencia += 1;
  const identificacao = `usuario-${sequencia}-${Date.now()}@clinica.invalid`;
  await prisma.usuario.create({
    data: {
      nome: `Usuario ${sequencia}`,
      identificacao,
      senhaHash: hashSenha,
      perfilId,
      unidadeId: UNIDADE,
      ativo: dados.ativo ?? true,
    },
  });
  return identificacao;
}

const entrar = (identificacao: string, senha = SENHA, manterConectado = false) =>
  request(contexto.servidor)
    .post('/api/v1/auth/login')
    .send({ identificacao, senha, manterConectado });

const cookiesDe = (resposta: request.Response): string[] => {
  const cabecalho = resposta.headers['set-cookie'] as unknown as string[] | undefined;
  return cabecalho ?? [];
};

const refreshDe = (resposta: request.Response): string => {
  const cookie = cookiesDe(resposta).find((c) => c.startsWith('filas_refresh='));
  return cookie!.split(';')[0]!;
};

const corpo = <T>(resposta: request.Response): T => resposta.body as T;

describe('autenticação e sessão (#10)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TESTE;
    process.env.JWT_SEGREDO ??= 'segredo-ficticio-de-teste-com-32-caracteres!';
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    hashSenha = await gerarHashSenha(SENHA);
    perfilId = (
      await prisma.perfil.create({
        data: {
          nome: `Recepcao ${Date.now()}`,
          permissoes: { create: [{ permissao: 'fila:consultar' }, { permissao: 'fila:chamar' }] },
        },
      })
    ).id;

    contexto = await criarAppDeTeste({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validarAmbiente }),
        PrismaModule,
        AuthModule,
      ],
    });
  });

  afterAll(async () => {
    await contexto.app.close();
    await prisma.$disconnect();
  });

  describe('login', () => {
    it('autentica, devolve as permissões e grava o refresh em cookie protegido', async () => {
      const identificacao = await criarUsuario();

      const resposta = await entrar(identificacao).expect(200);

      const { usuario, expiraEm } = corpo<{ usuario: UsuarioSessao; expiraEm: number }>(resposta);
      expect(usuario.permissoes.sort()).toEqual(['fila:chamar', 'fila:consultar']);
      expect(usuario.unidadeNome).toBe('Clínica-Escola');
      expect(expiraEm).toBe(15 * 60);
      const cookie = cookiesDe(resposta).find((c) => c.startsWith('filas_refresh='))!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
      expect(cookie).not.toMatch(/Max-Age/);
    });

    it('grava LOGIN na auditoria e o último acesso do usuário', async () => {
      const identificacao = await criarUsuario();

      await entrar(identificacao).expect(200);

      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { identificacao } });
      expect(usuario.ultimoLoginEm).not.toBeNull();
      expect(
        await prisma.auditLog.count({ where: { usuarioId: usuario.id, operacao: 'LOGIN' } }),
      ).toBe(1);
    });

    it('manterConectado grava cookie persistente até o fim das 8 horas', async () => {
      const identificacao = await criarUsuario();

      const resposta = await entrar(identificacao, SENHA, true).expect(200);

      const cookie = cookiesDe(resposta).find((c) => c.startsWith('filas_refresh='))!;
      const maxAge = /Max-Age=(\d+)/.exec(cookie)?.[1];
      expect(Number(maxAge)).toBeGreaterThan(8 * 3600 - 60);
      expect(Number(maxAge)).toBeLessThanOrEqual(8 * 3600);
    });

    it('responde igual para usuário inexistente, senha errada e conta inativa (T-01)', async () => {
      const ativo = await criarUsuario();
      const inativo = await criarUsuario({ ativo: false });

      const respostas = await Promise.all([
        entrar(`nao-existe-${Date.now()}@clinica.invalid`),
        entrar(ativo, 'senha-errada'),
        entrar(inativo),
      ]);

      for (const resposta of respostas) {
        expect(resposta.status).toBe(401);
        expect(corpo<Problema>(resposta)).toEqual(corpo<Problema>(respostas[0]));
        expect(corpo<Problema>(resposta).codigo).toBe('CREDENCIAL_INVALIDA');
      }
    });

    it('T-01 bloqueia na quinta falha e recusa até a senha certa durante o bloqueio', async () => {
      const identificacao = await criarUsuario();

      for (let i = 0; i < 4; i++) {
        const resposta = await entrar(identificacao, 'senha-errada').expect(401);
        expect(corpo<Problema>(resposta).codigo).toBe('CREDENCIAL_INVALIDA');
      }
      const quinta = await entrar(identificacao, 'senha-errada').expect(401);
      expect(corpo<ProblemaBloqueio>(quinta)).toMatchObject({
        codigo: 'BLOQUEIO_TEMPORARIO',
        minutosRestantes: 15,
      });

      const certa = await entrar(identificacao).expect(401);
      expect(corpo<Problema>(certa).codigo).toBe('BLOQUEIO_TEMPORARIO');
    });

    it('T-01 conta tentativas simultâneas sem perder nenhuma', async () => {
      const identificacao = await criarUsuario();

      const respostas = await Promise.all(
        Array.from({ length: 10 }, () => entrar(identificacao, 'senha-errada')),
      );

      const codigos = respostas.map((r) => corpo<Problema>(r).codigo);
      expect(codigos.filter((c) => c === 'CREDENCIAL_INVALIDA')).toHaveLength(4);
      expect(codigos.filter((c) => c === 'BLOQUEIO_TEMPORARIO')).toHaveLength(6);
    });

    it('T-01 também bloqueia identificação inexistente na quinta tentativa', async () => {
      const inexistente = `fantasma-${Date.now()}@clinica.invalid`;

      for (let i = 0; i < 4; i++) await entrar(inexistente).expect(401);
      const quinta = await entrar(inexistente).expect(401);

      expect(corpo<Problema>(quinta).codigo).toBe('BLOQUEIO_TEMPORARIO');
    });

    it('senha acima de 128 caracteres é recusada sem contar tentativa', async () => {
      const identificacao = await criarUsuario();

      await entrar(identificacao, 'x'.repeat(129)).expect(422);

      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { identificacao } });
      expect(usuario.tentativasFalhas).toBe(0);
    });
  });

  describe('sessão', () => {
    it('GET /auth/me devolve a sessão com o access token e 401 sem ele', async () => {
      const identificacao = await criarUsuario();
      const { accessToken } = corpo<{ accessToken: string }>(
        await entrar(identificacao).expect(200),
      );

      const me = await request(contexto.servidor)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(corpo<UsuarioSessao>(me).nome).toMatch(/^Usuario/);

      const sem = await request(contexto.servidor).get('/api/v1/auth/me').expect(401);
      expect(corpo<Problema>(sem).codigo).toBe('NAO_AUTENTICADO');
    });

    it('refresh troca o cookie; o antigo, dentro de 30 s, falha sem derrubar a sessão', async () => {
      const identificacao = await criarUsuario();
      const antigo = refreshDe(await entrar(identificacao).expect(200));

      const renovado = await request(contexto.servidor)
        .post('/api/v1/auth/refresh')
        .set('Cookie', antigo)
        .expect(200);
      const novo = refreshDe(renovado);
      expect(novo).not.toBe(antigo);

      await request(contexto.servidor)
        .post('/api/v1/auth/refresh')
        .set('Cookie', antigo)
        .expect(401);
      await request(contexto.servidor).post('/api/v1/auth/refresh').set('Cookie', novo).expect(200);
    });

    it('refresh antigo reapresentado depois de 30 s revoga a sessão (roubo)', async () => {
      const identificacao = await criarUsuario();
      const antigo = refreshDe(await entrar(identificacao).expect(200));
      const novo = refreshDe(
        await request(contexto.servidor).post('/api/v1/auth/refresh').set('Cookie', antigo),
      );
      const sessaoId = antigo.split('=')[1]!.split('.')[0]!;
      await prisma.sessao.update({
        where: { id: sessaoId },
        data: { rotacionadaEm: new Date(Date.now() - 31_000) },
      });

      await request(contexto.servidor)
        .post('/api/v1/auth/refresh')
        .set('Cookie', antigo)
        .expect(401);

      const sessao = await prisma.sessao.findUniqueOrThrow({ where: { id: sessaoId } });
      expect(sessao.motivoRevogacao).toBe('REUSO');
      await request(contexto.servidor).post('/api/v1/auth/refresh').set('Cookie', novo).expect(401);
    });

    it('logout revoga na hora: refresh e access token deixam de valer', async () => {
      const identificacao = await criarUsuario();
      const login = await entrar(identificacao).expect(200);
      const refresh = refreshDe(login);
      const { accessToken } = corpo<{ accessToken: string }>(login);

      const saida = await request(contexto.servidor)
        .post('/api/v1/auth/logout')
        .set('Cookie', refresh)
        .expect(204);

      expect(cookiesDe(saida).find((c) => c.startsWith('filas_refresh='))).toMatch(/Max-Age=0/);
      await request(contexto.servidor)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refresh)
        .expect(401);
      await request(contexto.servidor)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { identificacao } });
      expect(
        await prisma.auditLog.count({ where: { usuarioId: usuario.id, operacao: 'LOGOUT' } }),
      ).toBe(1);
    });

    it('logout sem cookie responde 204', async () => {
      await request(contexto.servidor).post('/api/v1/auth/logout').expect(204);
    });

    it('usuário inativado com sessão aberta perde o acesso na próxima requisição', async () => {
      const identificacao = await criarUsuario();
      const login = await entrar(identificacao).expect(200);
      const { accessToken } = corpo<{ accessToken: string }>(login);
      await prisma.usuario.update({ where: { identificacao }, data: { ativo: false } });

      await request(contexto.servidor)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      await request(contexto.servidor)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshDe(login))
        .expect(401);
    });

    it('sessão continua válida durante o bloqueio por tentativas de terceiros', async () => {
      const identificacao = await criarUsuario();
      const { accessToken } = corpo<{ accessToken: string }>(
        await entrar(identificacao).expect(200),
      );
      for (let i = 0; i < 5; i++) await entrar(identificacao, 'senha-errada');

      await request(contexto.servidor)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
