import {
  type Alocacao,
  type Problema,
  type ProblemaValidacao,
  type SenhaResumo,
} from '@filas/contracts';
import { type PrismaClient, type StatusSenha } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventosDominio, EventosDominioModule } from '../common/eventos/eventos-dominio';
import { IdempotenciaModule } from '../common/idempotencia/idempotencia.service';
import { Relogio, RelogioModule } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { AlocacaoModule } from './alocacao.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

/** Segunda-feira, 10h00 no fuso da unidade: turno MANHA. */
const SEGUNDA_DE_MANHA = new Date('2026-10-26T10:00:00-03:00');
const NO_TURNO = { diaSemana: 'SEGUNDA', turno: 'MANHA' } as const;

let contexto: Contexto;
let atendente: SessaoDeTeste;
let pacienteId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test) => req.set('Authorization', `Bearer ${atendente.token}`);

interface Cenario {
  especialidadeId: string;
  filaId: string;
  recursoId: string;
}

async function cenario(exigeSupervisao = true): Promise<Cenario> {
  const recurso = await contexto.prisma.recurso.create({ data: { nome: unico('Maca') } });
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: unico('Fisio'),
      unidadeId: UNIDADE_PADRAO,
      exigeSupervisaoDocente: exigeSupervisao,
      recursosExigidos: { create: { recursoId: recurso.id } },
      filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'Fisio', letraSenha: 'F' } },
    },
    include: { filas: true },
  });
  return {
    especialidadeId: especialidade.id,
    filaId: especialidade.filas[0]!.id,
    recursoId: recurso.id,
  };
}

async function senhaChamada(c: Cenario, status: StatusSenha = 'CHAMADA') {
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: atendente.usuarioId,
      especialidadeDestinoId: c.especialidadeId,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade: 'NORMAL',
      motivo: 'Motivo ficticio',
    },
  });
  return contexto.prisma.senha.create({
    data: {
      numero: `F${String(++seq % 1000).padStart(3, '0')}`,
      filaId: c.filaId,
      triagemId: triagem.id,
      pacienteId,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status,
    },
  });
}

const estudante = async (c: Cenario, noTurno = true, especialidadeId = c.especialidadeId) =>
  (
    await contexto.prisma.estudante.create({
      data: {
        nome: unico('Estudante'),
        especialidadeId,
        nivelFormacao: '7º período',
        ...(noTurno ? { disponibilidades: { create: NO_TURNO } } : {}),
      },
    })
  ).id;

const sala = async (c: Cenario, dados: { comRecurso?: boolean; situacao?: 'EM_MANUTENCAO' } = {}) =>
  (
    await contexto.prisma.sala.create({
      data: {
        identificacao: unico('Sala'),
        unidadeId: UNIDADE_PADRAO,
        ...(dados.situacao ? { situacao: dados.situacao } : {}),
        ...(dados.comRecurso === false ? {} : { recursos: { create: { recursoId: c.recursoId } } }),
      },
    })
  ).id;

const supervisor = async (c: Cenario, limite = 3, noTurno = true) =>
  (
    await contexto.prisma.supervisor.create({
      data: {
        nome: unico('Prof.'),
        limiteEstudantesSimultaneos: limite,
        especialidades: { create: { especialidadeId: c.especialidadeId } },
        ...(noTurno ? { disponibilidades: { create: NO_TURNO } } : {}),
      },
    })
  ).id;

const alocar = (senhaId: string, dados: Record<string, unknown>, chave?: string) => {
  const req = comToken(api().post(`/api/v1/senhas/${senhaId}/alocacao`));
  return (chave ? req.set('Idempotency-Key', chave) : req).send({ versao: 1, ...dados });
};

describe('alocação de estudante, supervisor e sala (#21)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, IdempotenciaModule, RelogioModule, AlocacaoModule],
    });
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockImplementation(() => SEGUNDA_DE_MANHA);
    atendente = await entrarComPermissoes(contexto, ['alocacao:criar', 'alocacao:editar']);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Carla Lima'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1970-01-01'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('RN-05 a RN-09 aloca estudante, supervisor e sala e incrementa a versão da senha', async () => {
    const c = await cenario();
    const senha = await senhaChamada(c);
    const dados = {
      estudanteId: await estudante(c),
      supervisorId: await supervisor(c),
      salaId: await sala(c),
    };

    const alocacao = corpo<Alocacao>(await alocar(senha.id, dados).expect(201));

    expect(alocacao).toMatchObject({
      senhaId: senha.id,
      estudante: { id: dados.estudanteId },
      supervisor: { id: dados.supervisorId },
      sala: { id: dados.salaId },
      liberadaEm: null,
    });
    expect(
      await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } }),
    ).toMatchObject({
      status: 'CHAMADA',
      versao: 2,
    });
    await alocar(senha.id, { ...dados, versao: 2 }).expect(409);
  });

  it('RN-05 estudante com alocação vigente ou fora do turno recebe RECURSO_INDISPONIVEL', async () => {
    const c = await cenario(false);
    const ocupado = await estudante(c);
    await alocar((await senhaChamada(c)).id, {
      estudanteId: ocupado,
      salaId: await sala(c),
    }).expect(201);

    const outra = await alocar((await senhaChamada(c)).id, {
      estudanteId: ocupado,
      salaId: await sala(c),
    });
    const foraDoTurno = await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c, false),
      salaId: await sala(c),
    });

    expect([outra.status, corpo<Problema>(outra).codigo]).toEqual([409, 'RECURSO_INDISPONIVEL']);
    expect([foraDoTurno.status, corpo<Problema>(foraDoTurno).codigo]).toEqual([
      409,
      'RECURSO_INDISPONIVEL',
    ]);
  });

  it('RN-06 estudante de outra especialidade e RN-09 sala sem o recurso recebem 422', async () => {
    const c = await cenario(false);
    const outra = await cenario(false);

    const resposta = await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c, true, outra.especialidadeId),
      salaId: await sala(c, { comRecurso: false }),
    }).expect(422);

    expect(corpo<ProblemaValidacao>(resposta).campos.map((campo) => campo.campo)).toEqual([
      'estudanteId',
      'salaId',
    ]);
  });

  it('RN-09 sala em manutenção recebe RECURSO_INDISPONIVEL', async () => {
    const c = await cenario(false);

    const resposta = await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c, { situacao: 'EM_MANUTENCAO' }),
    }).expect(409);

    expect(corpo<Problema>(resposta).codigo).toBe('RECURSO_INDISPONIVEL');
  });

  it('RN-09 duas confirmações simultâneas com a mesma sala: só uma é aceita', async () => {
    const c = await cenario(false);
    const salaId = await sala(c);
    const pedidos = await Promise.all(
      [await senhaChamada(c), await senhaChamada(c)].map(async (s) =>
        alocar(s.id, { estudanteId: await estudante(c), salaId }),
      ),
    );

    expect(pedidos.map((p) => p.status).sort()).toEqual([201, 409]);
    expect(corpo<Problema>(pedidos.find((p) => p.status === 409)!).codigo).toBe(
      'RECURSO_INDISPONIVEL',
    );
  });

  it('RN-07 especialidade sem supervisão aceita sem supervisor e recusa com supervisor', async () => {
    const c = await cenario(false);

    await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
    }).expect(201);
    const comSupervisor = await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      supervisorId: await supervisor(c),
    }).expect(422);

    expect(corpo<ProblemaValidacao>(comSupervisor).campos[0]?.campo).toBe('supervisorId');
  });

  it('RN-07 supervisor não habilitado na especialidade recebe 422', async () => {
    const c = await cenario();
    await supervisor(c);

    const resposta = await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      supervisorId: await supervisor(await cenario()),
    }).expect(422);

    expect(corpo<ProblemaValidacao>(resposta).campos[0]?.campo).toBe('supervisorId');
  });

  it('RN-08 supervisor no limite recebe LIMITE_SUPERVISAO_ATINGIDO', async () => {
    const c = await cenario();
    const noLimite = await supervisor(c, 1);
    await supervisor(c);
    await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      supervisorId: noLimite,
    }).expect(201);

    const resposta = await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      supervisorId: noLimite,
    }).expect(409);

    expect(corpo<Problema>(resposta).codigo).toBe('LIMITE_SUPERVISAO_ATINGIDO');
  });

  it('RN-08 confirmações simultâneas não passam do limite do supervisor', async () => {
    const c = await cenario();
    const limiteUm = await supervisor(c, 1);
    await supervisor(c);
    const pedidos = await Promise.all(
      [await senhaChamada(c), await senhaChamada(c), await senhaChamada(c)].map(async (s) =>
        alocar(s.id, {
          estudanteId: await estudante(c),
          salaId: await sala(c),
          supervisorId: limiteUm,
        }),
      ),
    );

    expect(pedidos.filter((p) => p.status === 201)).toHaveLength(1);
    expect(pedidos.filter((p) => p.status === 409).map((p) => corpo<Problema>(p).codigo)).toEqual([
      'LIMITE_SUPERVISAO_ATINGIDO',
      'LIMITE_SUPERVISAO_ATINGIDO',
    ]);
  });

  it('RN-10 sem supervisor disponível: SUPERVISOR_INDISPONIVEL, senha aguardando recurso e fila bloqueada', async () => {
    const c = await cenario();
    const soUm = await supervisor(c, 1);
    await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      supervisorId: soUm,
    }).expect(201);
    const senha = await senhaChamada(c);
    const ouvinte = vi.fn();
    const cancelar = contexto.app.get(EventosDominio).assinar('fila.bloqueada', ouvinte);

    const resposta = await alocar(senha.id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      supervisorId: soUm,
    }).expect(409);
    cancelar();

    expect(corpo<Problema>(resposta).codigo).toBe('SUPERVISOR_INDISPONIVEL');
    expect(
      await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } }),
    ).toMatchObject({
      status: 'AGUARDANDO_RECURSO',
      recursoFaltante: 'SUPERVISOR',
    });
    expect(await contexto.prisma.fila.findUniqueOrThrow({ where: { id: c.filaId } })).toMatchObject(
      {
        bloqueada: true,
      },
    );
    expect(ouvinte).toHaveBeenCalledWith(expect.objectContaining({ filaId: c.filaId }));
    expect(await contexto.prisma.alocacao.count({ where: { senhaId: senha.id } })).toBe(0);
  });

  it('troca de sala libera a alocação anterior na mesma transação', async () => {
    const c = await cenario(false);
    const senha = await senhaChamada(c);
    const estudanteId = await estudante(c);
    const anterior = corpo<Alocacao>(
      await alocar(senha.id, { estudanteId, salaId: await sala(c) }).expect(201),
    );
    const novaSala = await sala(c);

    const nova = corpo<Alocacao>(
      await comToken(api().put(`/api/v1/senhas/${senha.id}/alocacao`))
        .send({ estudanteId, salaId: novaSala, versao: 2 })
        .expect(200),
    );

    expect(nova).toMatchObject({ estudante: { id: estudanteId }, sala: { id: novaSala } });
    expect(
      (await contexto.prisma.alocacao.findUniqueOrThrow({ where: { id: anterior.id } })).liberadaEm,
    ).not.toBeNull();
  });

  it('manter aguardando registra o recurso faltante e a alocação segue a partir daí', async () => {
    const c = await cenario(false);
    const senha = await senhaChamada(c);

    const aguardando = corpo<SenhaResumo>(
      await comToken(api().post(`/api/v1/senhas/${senha.id}/aguardando-recurso`))
        .send({ recursoFaltante: 'SALA', versao: 1 })
        .expect(200),
    );
    await alocar(senha.id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
      versao: 2,
    }).expect(201);

    expect(aguardando).toMatchObject({
      status: 'AGUARDANDO_RECURSO',
      recursoFaltante: 'SALA',
      versao: 2,
    });
    await comToken(api().post(`/api/v1/senhas/${senha.id}/aguardando-recurso`))
      .send({ recursoFaltante: 'SALA', versao: 3 })
      .expect(409);
  });

  it('a mesma Idempotency-Key devolve a mesma alocação', async () => {
    const c = await cenario(false);
    const senha = await senhaChamada(c);
    const dados = { estudanteId: await estudante(c), salaId: await sala(c) };
    const chave = randomUUID();

    const primeira = corpo<Alocacao>(await alocar(senha.id, dados, chave).expect(201));
    const repetida = corpo<Alocacao>(await alocar(senha.id, dados, chave).expect(201));

    expect(repetida).toEqual(primeira);
    expect(await contexto.prisma.alocacao.count({ where: { senhaId: senha.id } })).toBe(1);
  });

  it('senha ainda aguardando chamada não é alocada', async () => {
    const c = await cenario(false);

    const resposta = await alocar((await senhaChamada(c, 'AGUARDANDO')).id, {
      estudanteId: await estudante(c),
      salaId: await sala(c),
    }).expect(409);

    expect(corpo<Problema>(resposta).codigo).toBe('TRANSICAO_INVALIDA');
  });
});
