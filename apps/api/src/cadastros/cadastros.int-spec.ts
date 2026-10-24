import {
  type Especialidade,
  type ItemReferencia,
  type Problema,
  type RespostaPaginada,
  type Sala,
} from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { CadastrosModule } from './cadastros.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let admin: SessaoDeTeste;
let maca: ItemReferencia;
let cadeira: ItemReferencia;
let marca = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++marca}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = admin) =>
  req.set('Authorization', `Bearer ${sessao.token}`);

const novaEspecialidade = (dados: Record<string, unknown> = {}) =>
  comToken(api().post('/api/v1/especialidades')).send({
    nome: unico('Fisioterapia'),
    exigeSupervisaoDocente: true,
    exigeValidacaoEncerramento: false,
    ...dados,
  });

describe('cadastros de especialidade e sala (#13)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [CadastrosModule] });
    admin = await entrarComPermissoes(contexto, [
      'cadastros:consultar',
      'cadastros:criar',
      'cadastros:editar',
      'cadastros:excluir',
    ]);
    maca = await contexto.prisma.recurso.create({ data: { nome: unico('Maca') } });
    cadeira = await contexto.prisma.recurso.create({ data: { nome: unico('Cadeira') } });
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  describe('cadastros de apoio', () => {
    it('lista recursos paginados com busca', async () => {
      const resposta = await comToken(
        api().get(`/api/v1/recursos?busca=${encodeURIComponent(maca.nome)}`),
      ).expect(200);

      expect(corpo<RespostaPaginada<ItemReferencia>>(resposta).dados).toEqual([maca]);
    });

    it('habilitações e procedimentos respondem no mesmo formato', async () => {
      await comToken(api().get('/api/v1/habilitacoes')).expect(200);
      await comToken(api().get('/api/v1/procedimentos')).expect(200);
    });
  });

  describe('salas (RN-09)', () => {
    it('cadastra com recursos e situação, e audita', async () => {
      const resposta = await comToken(api().post('/api/v1/salas'))
        .send({ identificacao: 'Sala 1', recursosIds: [maca.id] })
        .expect(201);

      const sala = corpo<Sala>(resposta);
      expect(sala).toMatchObject({ situacao: 'DISPONIVEL', ocupada: false, ativo: true });
      expect(sala.recursos).toEqual([maca]);
      expect(
        await contexto.prisma.auditLog.count({
          where: { entidade: 'sala', entidadeId: sala.id, operacao: 'CRIAR' },
        }),
      ).toBe(1);
    });

    it('aceita duas salas com a mesma identificação (sem duplicidade, Tabela A)', async () => {
      await comToken(api().post('/api/v1/salas'))
        .send({ identificacao: 'Sala repetida' })
        .expect(201);
      await comToken(api().post('/api/v1/salas'))
        .send({ identificacao: 'Sala repetida' })
        .expect(201);
    });

    it('recusa recurso inexistente e situação fora da Tabela 4', async () => {
      await comToken(api().post('/api/v1/salas'))
        .send({ identificacao: 'Sala X', recursosIds: ['0190a000-0000-7000-8000-0000000000ff'] })
        .expect(422);
      await comToken(api().post('/api/v1/salas'))
        .send({ identificacao: 'Sala X', situacao: 'OCUPADA' })
        .expect(422);
    });

    it('filtra por recurso e por disponibilidade', async () => {
      const comCadeira = corpo<Sala>(
        await comToken(api().post('/api/v1/salas')).send({
          identificacao: unico('Consultorio'),
          recursosIds: [cadeira.id],
          situacao: 'EM_MANUTENCAO',
        }),
      );

      const porRecurso = corpo<RespostaPaginada<Sala>>(
        await comToken(api().get(`/api/v1/salas?recursoId=${cadeira.id}`)).expect(200),
      );
      expect(porRecurso.dados.map((s) => s.id)).toEqual([comCadeira.id]);

      const disponiveis = corpo<RespostaPaginada<Sala>>(
        await comToken(api().get('/api/v1/salas?disponivel=true&tamanho=100')).expect(200),
      );
      expect(disponiveis.dados.some((s) => s.id === comCadeira.id)).toBe(false);
    });

    it('edita trocando os recursos, inativa por PATCH e exclui', async () => {
      const sala = corpo<Sala>(
        await comToken(api().post('/api/v1/salas')).send({
          identificacao: 'Sala editavel',
          recursosIds: [maca.id],
        }),
      );

      const editada = await comToken(api().put(`/api/v1/salas/${sala.id}`))
        .send({ identificacao: 'Sala editada', recursosIds: [cadeira.id] })
        .expect(200);
      expect(corpo<Sala>(editada).recursos).toEqual([cadeira]);

      const inativa = await comToken(api().patch(`/api/v1/salas/${sala.id}`))
        .send({ ativo: false })
        .expect(200);
      expect(corpo<Sala>(inativa).ativo).toBe(false);

      await comToken(api().delete(`/api/v1/salas/${sala.id}`)).expect(204);
      await comToken(api().get(`/api/v1/salas/${sala.id}`)).expect(404);
    });

    it('ordena por identificação e recusa campo fora da lista', async () => {
      await comToken(api().get('/api/v1/salas?ordenar=identificacao&direcao=desc')).expect(200);
      await comToken(api().get('/api/v1/salas?ordenar=situacao')).expect(422);
    });
  });

  describe('especialidades (RN-07, RN-11, RN-12)', () => {
    it('cadastra com recursos exigidos e tolerância própria', async () => {
      const resposta = await novaEspecialidade({
        toleranciaMinutos: 10,
        recursosExigidosIds: [maca.id],
      }).expect(201);

      const especialidade = corpo<Especialidade>(resposta);
      expect(especialidade).toMatchObject({
        exigeSupervisaoDocente: true,
        toleranciaMinutos: 10,
        filasVinculadas: 0,
        ativa: true,
      });
      expect(especialidade.recursosExigidos).toEqual([maca]);
      const parametro = await contexto.prisma.parametroUnidade.findFirst({
        where: { especialidadeId: especialidade.id, chave: 'TOLERANCIA_MINUTOS' },
      });
      expect(parametro?.valor).toBe(10);
    });

    it('sem tolerância própria usa o parâmetro da unidade (nulo)', async () => {
      const resposta = await novaEspecialidade().expect(201);

      expect(corpo<Especialidade>(resposta).toleranciaMinutos).toBeNull();
    });

    it('UC-01 recusa nome repetido sem diferenciar maiúsculas, com o id existente', async () => {
      const original = corpo<Especialidade>(await novaEspecialidade());

      const resposta = await novaEspecialidade({ nome: original.nome.toUpperCase() }).expect(409);

      expect(corpo<Problema & { recursoExistenteId: string }>(resposta)).toMatchObject({
        codigo: 'DUPLICIDADE',
        recursoExistenteId: original.id,
      });
    });

    it('editar remove a tolerância própria quando ela não é enviada', async () => {
      const especialidade = corpo<Especialidade>(await novaEspecialidade({ toleranciaMinutos: 7 }));

      const editada = await comToken(api().put(`/api/v1/especialidades/${especialidade.id}`))
        .send({
          nome: especialidade.nome,
          exigeSupervisaoDocente: false,
          exigeValidacaoEncerramento: true,
        })
        .expect(200);

      expect(corpo<Especialidade>(editada)).toMatchObject({
        toleranciaMinutos: null,
        exigeValidacaoEncerramento: true,
      });
    });

    it('não exclui especialidade com estudante e diz o vínculo; inativar funciona', async () => {
      const especialidade = corpo<Especialidade>(await novaEspecialidade());
      await contexto.prisma.estudante.create({
        data: { nome: 'Estudante', especialidadeId: especialidade.id, nivelFormacao: '5º período' },
      });

      const resposta = await comToken(
        api().delete(`/api/v1/especialidades/${especialidade.id}`),
      ).expect(409);
      expect(corpo<Problema>(resposta)).toMatchObject({ codigo: 'VINCULO_ATIVO' });
      expect(corpo<Problema>(resposta).detail).toMatch(/1 estudante/);

      const inativa = await comToken(api().patch(`/api/v1/especialidades/${especialidade.id}`))
        .send({ ativa: false })
        .expect(200);
      expect(corpo<Especialidade>(inativa).ativa).toBe(false);
    });

    it('exclui especialidade sem vínculo junto com a tolerância própria', async () => {
      const especialidade = corpo<Especialidade>(await novaEspecialidade({ toleranciaMinutos: 3 }));

      await comToken(api().delete(`/api/v1/especialidades/${especialidade.id}`)).expect(204);

      expect(
        await contexto.prisma.parametroUnidade.count({
          where: { especialidadeId: especialidade.id },
        }),
      ).toBe(0);
    });

    it('filtra por ativa e por exigência de supervisão', async () => {
      const resposta = await comToken(
        api().get('/api/v1/especialidades?ativa=true&exigeSupervisao=true&tamanho=100'),
      ).expect(200);

      const { dados } = corpo<RespostaPaginada<Especialidade>>(resposta);
      expect(dados.every((e) => e.ativa && e.exigeSupervisaoDocente)).toBe(true);
    });
  });

  describe('RNF-08: isolamento por unidade', () => {
    it('não enxerga sala de outra unidade', async () => {
      const outra = await contexto.prisma.unidade.create({
        data: { nome: unico('Outra unidade') },
      });
      const salaDeFora = await contexto.prisma.sala.create({
        data: { identificacao: 'Sala de fora', unidadeId: outra.id },
      });

      await comToken(api().get(`/api/v1/salas/${salaDeFora.id}`)).expect(404);
      expect(UNIDADE_PADRAO).not.toBe(outra.id);
    });
  });

  it('sem cadastros:criar, responde 403', async () => {
    const leitor = await entrarComPermissoes(contexto, ['cadastros:consultar']);

    await comToken(api().post('/api/v1/salas'), leitor).send({ identificacao: 'x' }).expect(403);
  });
});
