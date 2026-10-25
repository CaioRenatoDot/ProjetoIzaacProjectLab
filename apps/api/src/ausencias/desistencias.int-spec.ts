import { type DesistenciaResposta, type Problema } from '@filas/contracts';
import { type PrismaClient, type StatusSenha } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EventosDominioModule } from '../common/eventos/eventos-dominio';
import { RelogioModule } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { AusenciasModule } from './ausencias.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let recepcao: SessaoDeTeste;
let pacienteId: string;
let especialidadeId: string;
let filaId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;

async function novaSenha(status: StatusSenha) {
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: recepcao.usuarioId,
      especialidadeDestinoId: especialidadeId,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade: 'NORMAL',
      motivo: 'Motivo ficticio',
    },
  });
  return contexto.prisma.senha.create({
    data: {
      numero: `D${String(++seq % 1000).padStart(3, '0')}`,
      filaId,
      triagemId: triagem.id,
      pacienteId,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status,
    },
  });
}

const desistir = (senhaId: string, dados: Record<string, unknown> = {}) =>
  request(contexto.servidor)
    .post(`/api/v1/senhas/${senhaId}/desistencia`)
    .set('Authorization', `Bearer ${recepcao.token}`)
    .send({ origem: 'PACIENTE', versao: 1, ...dados });

describe('desistência voluntária (#25)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, RelogioModule, AusenciasModule],
    });
    recepcao = await entrarComPermissoes(contexto, ['ausencia:criar']);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Bruno Dias'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1995-01-01'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
    const especialidade = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Desistencia'),
        unidadeId: UNIDADE_PADRAO,
        filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'D', letraSenha: 'D' } },
      },
      include: { filas: true },
    });
    especialidadeId = especialidade.id;
    filaId = especialidade.filas[0]!.id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('UC-17 senha AGUARDANDO sem motivo vai a DESISTENCIA, só em desistencia', async () => {
    const senha = await novaSenha('AGUARDANDO');

    const resposta = corpo<DesistenciaResposta>(await desistir(senha.id).expect(200));

    expect(resposta).toMatchObject({
      senha: { status: 'DESISTENCIA', posicao: null, versao: 2 },
      recursosLiberados: false,
    });
    expect(
      await contexto.prisma.desistencia.findUnique({ where: { senhaId: senha.id } }),
    ).toMatchObject({
      origem: 'PACIENTE',
      motivo: null,
      registradoPor: recepcao.usuarioId,
    });
    expect(await contexto.prisma.ausencia.count({ where: { senhaId: senha.id } })).toBe(0);
    expect(
      await contexto.prisma.auditLog.count({
        where: { entidadeId: senha.id, entidade: 'desistencia' },
      }),
    ).toBe(1);
  });

  it.each(['CHAMADA', 'AGUARDANDO_RECURSO', 'PAUSADO', 'ENCERRADO'] as const)(
    'UC-17 senha %s recebe 409 TRANSICAO_INVALIDA',
    async (status) => {
      const senha = await novaSenha(status);

      expect(corpo<Problema>(await desistir(senha.id).expect(409)).codigo).toBe(
        'TRANSICAO_INVALIDA',
      );
      expect(await contexto.prisma.desistencia.count({ where: { senhaId: senha.id } })).toBe(0);
    },
  );

  it('UC-17 em atendimento: encerra o atendimento sem desfecho e libera a alocação', async () => {
    const senha = await novaSenha('EM_ATENDIMENTO');
    const alocacao = await contexto.prisma.alocacao.create({
      data: {
        senhaId: senha.id,
        estudanteId: (
          await contexto.prisma.estudante.create({
            data: { nome: unico('Estudante'), especialidadeId, nivelFormacao: '9º' },
          })
        ).id,
        salaId: (
          await contexto.prisma.sala.create({
            data: { identificacao: unico('Sala'), unidadeId: UNIDADE_PADRAO },
          })
        ).id,
        confirmadaPor: recepcao.usuarioId,
      },
    });
    const atendimento = await contexto.prisma.atendimento.create({
      data: { senhaId: senha.id, alocacaoId: alocacao.id, validacaoExigida: false },
    });

    const resposta = corpo<DesistenciaResposta>(
      await desistir(senha.id, { origem: 'EQUIPE', motivo: 'Paciente precisou sair' }).expect(200),
    );

    expect(resposta.recursosLiberados).toBe(true);
    expect(
      (await contexto.prisma.alocacao.findUniqueOrThrow({ where: { id: alocacao.id } })).liberadaEm,
    ).not.toBeNull();
    expect(
      await contexto.prisma.atendimento.findUniqueOrThrow({ where: { id: atendimento.id } }),
    ).toMatchObject({
      desfecho: null,
      encerradoEm: expect.any(Date) as Date,
    });
  });

  it('versão desatualizada recebe 409 VERSAO_DESATUALIZADA', async () => {
    const senha = await novaSenha('AGUARDANDO');

    expect(corpo<Problema>(await desistir(senha.id, { versao: 7 }).expect(409)).codigo).toBe(
      'VERSAO_DESATUALIZADA',
    );
  });
});
