import { type Perfil, type PerfilAtualizado, type Problema, type Usuario } from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { PerfisModule } from './perfis.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

const TODAS = ['perfis:consultar', 'perfis:criar', 'perfis:editar', 'perfis:excluir'];
let contexto: Contexto;
let admin: SessaoDeTeste;
let marca = 0;
const nome = (base: string) => `${base} ${Date.now()}-${++marca}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;

const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = admin) =>
  req.set('Authorization', `Bearer ${sessao.token}`);

describe('API de perfis, permissões e usuários (#12)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [PerfisModule] });
    admin = await entrarComPermissoes(contexto, TODAS);
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  describe('perfis', () => {
    it('GET /permissoes devolve o catálogo com módulos sensíveis', async () => {
      const resposta = await comToken(api().get('/api/v1/permissoes')).expect(200);

      const triagem = corpo<{ modulo: string; sensivel: boolean }[]>(resposta).find(
        (m) => m.modulo === 'triagem',
      );
      expect(triagem?.sensivel).toBe(true);
    });

    it('UC-04 cria perfil, avisa quando não há permissão de consulta e audita', async () => {
      const resposta = await comToken(api().post('/api/v1/perfis'))
        .send({ nome: nome('Chamada'), permissoes: ['fila:chamar'] })
        .expect(201);

      const perfil = corpo<Perfil>(resposta);
      expect(perfil.sistema).toBe(false);
      expect(perfil.avisos[0]?.codigo).toBe('PERFIL_SEM_CONSULTA');
      expect(
        await contexto.prisma.auditLog.count({
          where: { entidade: 'perfil', entidadeId: perfil.id, operacao: 'CRIAR' },
        }),
      ).toBe(1);
    });

    it('recusa nome repetido sem diferenciar maiúsculas, com o id existente', async () => {
      const original = nome('Recepcao');
      const criado = corpo<Perfil>(
        await comToken(api().post('/api/v1/perfis')).send({ nome: original, permissoes: [] }),
      );

      const resposta = await comToken(api().post('/api/v1/perfis'))
        .send({ nome: original.toUpperCase(), permissoes: [] })
        .expect(409);

      expect(corpo<Problema & { recursoExistenteId: string }>(resposta)).toMatchObject({
        codigo: 'DUPLICIDADE',
        recursoExistenteId: criado.id,
      });
    });

    it('recusa permissão fora do catálogo', async () => {
      const resposta = await comToken(api().post('/api/v1/perfis'))
        .send({ nome: nome('Invalido'), permissoes: ['fila:voar'] })
        .expect(422);

      expect(corpo<Problema>(resposta).codigo).toBe('VALIDACAO');
    });

    it('PUT devolve usuariosAfetados só quando as permissões mudam', async () => {
      const perfil = corpo<Perfil>(
        await comToken(api().post('/api/v1/perfis')).send({
          nome: nome('Triagem'),
          permissoes: ['triagem:consultar'],
        }),
      );
      await contexto.prisma.usuario.create({
        data: {
          nome: 'Vinculado',
          identificacao: `vinculado-${Date.now()}@clinica.invalid`,
          senhaHash: 'x',
          perfilId: perfil.id,
          unidadeId: '01900000-0000-7000-8000-000000000001',
        },
      });

      const semMudanca = await comToken(api().put(`/api/v1/perfis/${perfil.id}`))
        .send({ nome: perfil.nome.toUpperCase(), permissoes: ['triagem:consultar'] })
        .expect(200);
      expect(corpo<PerfilAtualizado>(semMudanca).usuariosAfetados).toBe(0);

      const comMudanca = await comToken(api().put(`/api/v1/perfis/${perfil.id}`))
        .send({ nome: perfil.nome, permissoes: ['triagem:consultar', 'triagem:criar'] })
        .expect(200);
      expect(corpo<PerfilAtualizado>(comMudanca).usuariosAfetados).toBe(1);
    });

    it('não edita nem exclui perfil do sistema', async () => {
      const sistema = await contexto.prisma.perfil.create({
        data: { nome: nome('Administrador'), sistema: true },
      });

      const edicao = await comToken(api().put(`/api/v1/perfis/${sistema.id}`))
        .send({ nome: 'Outro', permissoes: [] })
        .expect(409);
      expect(corpo<Problema>(edicao).codigo).toBe('PERFIL_SISTEMA');
      await comToken(api().delete(`/api/v1/perfis/${sistema.id}`)).expect(409);
    });

    it('não exclui perfil com usuário vinculado e exclui o que não tem', async () => {
      const comUsuario = await comToken(api().delete(`/api/v1/perfis/${admin.perfilId}`)).expect(
        409,
      );
      expect(corpo<Problema>(comUsuario).codigo).toBe('VINCULO_ATIVO');

      const livre = corpo<Perfil>(
        await comToken(api().post('/api/v1/perfis')).send({ nome: nome('Livre'), permissoes: [] }),
      );
      await comToken(api().delete(`/api/v1/perfis/${livre.id}`)).expect(204);
      await comToken(api().get(`/api/v1/perfis/${livre.id}`)).expect(404);
    });

    it('sem a permissão, responde 403 mesmo para perfil inexistente', async () => {
      const leitor = await entrarComPermissoes(contexto, ['fila:consultar']);

      await comToken(
        api().get('/api/v1/perfis/0190a000-0000-7000-8000-0000000000ff'),
        leitor,
      ).expect(403);
    });

    it('lista paginada com busca', async () => {
      const resposta = await comToken(api().get('/api/v1/perfis?busca=recepcao&tamanho=5')).expect(
        200,
      );

      const { meta } = corpo<{ meta: { tamanho: number; total: number } }>(resposta);
      expect(meta.tamanho).toBe(5);
      expect(meta.total).toBeGreaterThan(0);
    });
  });

  describe('usuários', () => {
    const novoUsuario = async () =>
      corpo<Usuario>(
        await comToken(api().post('/api/v1/usuarios'))
          .send({
            nome: 'Pessoa Ficticia',
            identificacao: ` Pessoa-${Date.now()}-${++marca}@Clinica.Invalid `,
            senhaInicial: 'senha-inicial-1',
            perfilId: admin.perfilId,
          })
          .expect(201),
      );

    it('cria usuário com identificação normalizada e sem devolver a senha', async () => {
      const usuario = await novoUsuario();

      expect(usuario.identificacao).toBe(usuario.identificacao.trim().toLowerCase());
      expect(JSON.stringify(usuario)).not.toMatch(/senha/i);
    });

    it('recusa identificação repetida e perfil inexistente', async () => {
      const usuario = await novoUsuario();

      const repetido = await comToken(api().post('/api/v1/usuarios'))
        .send({
          nome: 'Outra',
          identificacao: usuario.identificacao.toUpperCase(),
          senhaInicial: 'senha-inicial-1',
          perfilId: admin.perfilId,
        })
        .expect(409);
      expect(corpo<Problema & { recursoExistenteId: string }>(repetido).recursoExistenteId).toBe(
        usuario.id,
      );

      await comToken(api().post('/api/v1/usuarios'))
        .send({
          nome: 'Outra',
          identificacao: `sem-perfil-${Date.now()}@clinica.invalid`,
          senhaInicial: 'senha-inicial-1',
          perfilId: '0190a000-0000-7000-8000-0000000000ff',
        })
        .expect(422);
    });

    it('inativar encerra as sessões do usuário na hora', async () => {
      const alvo = await entrarComPermissoes(contexto, ['fila:consultar']);
      await comToken(api().get('/api/v1/auth/me'), alvo).expect(200);

      await comToken(api().patch(`/api/v1/usuarios/${alvo.usuarioId}`))
        .send({ ativo: false })
        .expect(200);

      await comToken(api().get('/api/v1/auth/me'), alvo).expect(401);
    });

    it('desbloquear libera o login bloqueado por tentativas', async () => {
      const usuario = await novoUsuario();
      await contexto.prisma.usuario.update({
        where: { id: usuario.id },
        data: { bloqueadoAte: new Date(Date.now() + 600_000), tentativasFalhas: 0 },
      });
      expect(
        corpo<Usuario>(await comToken(api().get(`/api/v1/usuarios/${usuario.id}`))).bloqueadoAte,
      ).not.toBeNull();

      const resposta = await comToken(api().patch(`/api/v1/usuarios/${usuario.id}`))
        .send({ desbloquear: true })
        .expect(200);

      expect(corpo<Usuario>(resposta).bloqueadoAte).toBeNull();
    });

    it('ninguém inativa o próprio usuário nem troca o próprio perfil', async () => {
      await comToken(api().patch(`/api/v1/usuarios/${admin.usuarioId}`))
        .send({ ativo: false })
        .expect(422);
      const outro = corpo<Perfil>(
        await comToken(api().post('/api/v1/perfis')).send({ nome: nome('Outro'), permissoes: [] }),
      );
      await comToken(api().patch(`/api/v1/usuarios/${admin.usuarioId}`))
        .send({ perfilId: outro.id })
        .expect(422);
    });

    it('PATCH sem campos é recusado', async () => {
      const usuario = await novoUsuario();

      await comToken(api().patch(`/api/v1/usuarios/${usuario.id}`))
        .send({})
        .expect(422);
    });

    it('lista filtrando por perfil e situação', async () => {
      const resposta = await comToken(
        api().get(`/api/v1/usuarios?perfilId=${admin.perfilId}&ativo=true`),
      ).expect(200);

      const { dados } = corpo<{ dados: Usuario[] }>(resposta);
      expect(dados.length).toBeGreaterThan(0);
      expect(dados.every((u) => u.perfilId === admin.perfilId && u.ativo)).toBe(true);
    });
  });
});
