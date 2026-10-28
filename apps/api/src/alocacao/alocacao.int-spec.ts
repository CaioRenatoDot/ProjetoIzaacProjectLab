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
import { AuditoriaService } from '../common/auditoria/auditoria.service';
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
import { SugestoesAlocacao } from './dto/sugestoes.dto';

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
  unidadeId: string;
  especialidadeId: string;
  filaId: string;
  recursoId: string;
}

async function cenario(exigeSupervisao = true, unidadeId = UNIDADE_PADRAO): Promise<Cenario> {
  const recurso = await contexto.prisma.recurso.create({ data: { nome: unico('Maca') } });
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: unico('Fisio'),
      unidadeId,
      exigeSupervisaoDocente: exigeSupervisao,
      recursosExigidos: { create: { recursoId: recurso.id } },
      filas: { create: { unidadeId, nome: 'Fisio', letraSenha: 'F' } },
    },
    include: { filas: true },
  });
  return {
    unidadeId,
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
        unidadeId: c.unidadeId,
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
    atendente = await entrarComPermissoes(contexto, [
      'alocacao:criar',
      'alocacao:editar',
      'alocacao:consultar',
    ]);
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
    for (const [entidade, entidadeId] of [
      ['fila', c.filaId],
      ['senha', senha.id],
    ]) {
      const registros = await contexto.prisma.auditLog.findMany({
        where: { entidade, entidadeId, modulo: 'alocacao', operacao: 'EDITAR' },
      });
      expect(registros).toHaveLength(1);
      expect(registros[0]?.usuarioId).toBe(atendente.usuarioId);
    }
  });

  it('RN-10 e RNF-05 falha de auditoria desfaz bloqueio e espera por supervisor sem evento', async () => {
    const c = await cenario();
    const senha = await senhaChamada(c);
    const entrada = { estudanteId: await estudante(c), salaId: await sala(c) };
    const falha = vi
      .spyOn(contexto.app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('Falha fictícia de auditoria'));
    const evento = vi.spyOn(contexto.app.get(EventosDominio), 'emitir');
    try {
      await alocar(senha.id, entrada).expect(500);
      expect(
        (await contexto.prisma.fila.findUniqueOrThrow({ where: { id: c.filaId } })).bloqueada,
      ).toBe(false);
      expect(
        (await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } })).status,
      ).toBe('CHAMADA');
      expect(evento).not.toHaveBeenCalled();
      expect(
        await contexto.prisma.auditLog.count({ where: { entidade: 'fila', entidadeId: c.filaId } }),
      ).toBe(0);
    } finally {
      falha.mockRestore();
      evento.mockRestore();
    }
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

  const sugerir = async (senhaId: string) =>
    SugestoesAlocacao.parse(
      (await comToken(api().get(`/api/v1/senhas/${senhaId}/alocacao/sugestoes`)).expect(200)).body,
    );

  it('#22 RN-05 a RN-09: sugere um apto por bloco e a confirmação aceita os mesmos recursos', async () => {
    const c = await cenario();
    const senha = await senhaChamada(c);
    const estudanteId = await estudante(c);
    const supervisorId = await supervisor(c);
    const salaId = await sala(c);
    const r = await sugerir(senha.id);
    expect(r.estudante.sugestao).toMatchObject({ id: estudanteId, apto: true, motivoTexto: null });
    expect(r.supervisor).toMatchObject({
      aplicavel: true,
      sugestao: { id: supervisorId, apto: true },
    });
    expect(r.sala.sugestao).toMatchObject({ id: salaId, apto: true });
    for (const bloco of [r.estudante, r.supervisor, r.sala])
      expect(bloco.alternativas.some((a) => a.id === bloco.sugestao!.id)).toBe(false);
    expect(await contexto.prisma.alocacao.count({ where: { senhaId: senha.id } })).toBe(0);
    await alocar(senha.id, { estudanteId, supervisorId, salaId }).expect(201);
  });

  it('#22 RN-05 estudante fora do turno aparece nas alternativas; RN-07 sem supervisão oculta o bloco', async () => {
    const c = await cenario(false);
    const s = await senhaChamada(c);
    const foraId = await estudante(c, false);
    await contexto.prisma.estudante.update({
      where: { id: foraId },
      data: { nome: '! Fora do turno' },
    });
    await estudante(c);
    await sala(c);
    const r = await sugerir(s.id);
    const fora = r.estudante.alternativas.find((e) => e.id === foraId);
    expect(fora).toMatchObject({ apto: false, motivoInaptidao: 'FORA_DO_TURNO' });
    expect(fora?.motivoTexto).toContain('turno');
    expect(r.supervisor).toEqual({
      aplicavel: false,
      sugestao: null,
      alternativas: [],
      regrasVerificadas: [],
    });
  });

  it('#22 RN-08 supervisor ocupado até o limite aparece com motivo textual; sugere outro', async () => {
    const c = await cenario();
    const ocupado = await supervisor(c, 1);
    const livre = await supervisor(c);
    await contexto.prisma.supervisor.update({
      where: { id: ocupado },
      data: { nome: '! Limite atingido' },
    });
    await alocar((await senhaChamada(c)).id, {
      estudanteId: await estudante(c),
      supervisorId: ocupado,
      salaId: await sala(c),
    }).expect(201);
    const r = await sugerir((await senhaChamada(c)).id);
    expect(r.supervisor.sugestao?.id).toBe(livre);
    const limitado = r.supervisor.alternativas.find((s) => s.id === ocupado);
    expect(limitado?.motivoInaptidao).toBe('LIMITE_SUPERVISAO_ATINGIDO');
    expect(limitado?.motivoTexto).toContain('limite');
  });

  it('#22 RN-05 e RN-09 uma sugestão tomada antes da confirmação continua sujeita ao 409', async () => {
    const c = await cenario(false);
    const s = await senhaChamada(c);
    const estudanteId = await estudante(c);
    const salaId = await sala(c);
    await sugerir(s.id);
    await alocar((await senhaChamada(c)).id, { estudanteId, salaId }).expect(201);
    const r = await alocar(s.id, { estudanteId, salaId }).expect(409);
    expect(corpo<Problema>(r).codigo).toBe('RECURSO_INDISPONIVEL');
    const nova = await sugerir(s.id);
    expect(nova.estudante.sugestao).toBeNull();
    expect(nova.sala.sugestao).toBeNull();
  });

  it('#22 busca em lotes encontra apto após cem inaptos, sem repetir sugestão nem exceder vinte alternativas', async () => {
    const c = await cenario(false);
    const s = await senhaChamada(c);
    await contexto.prisma.estudante.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        nome: `! Inapto ${i}`,
        especialidadeId: c.especialidadeId,
        nivelFormacao: '7º período',
      })),
    });
    const apto = await estudante(c);
    const r = await sugerir(s.id);
    expect(r.estudante.sugestao?.id).toBe(apto);
    expect(r.estudante.alternativas).toHaveLength(20);
  });

  it('#22 autorização neutra, isolamento por unidade e estado alocável são respeitados', async () => {
    const c = await cenario(false);
    const s = await senhaChamada(c);
    const rota = (id: string) => `/api/v1/senhas/${id}/alocacao/sugestoes`;
    await api().get(rota(s.id)).expect(401);
    const semPermissao = await entrarComPermissoes(contexto, []);
    for (const id of [s.id, randomUUID()]) {
      const r = await api().get(rota(id)).auth(semPermissao.token, { type: 'bearer' }).expect(403);
      expect(corpo<Problema>(r).codigo).toBe('SEM_PERMISSAO');
    }
    const unidade = await contexto.prisma.unidade.create({
      data: { nome: unico('Outra unidade') },
    });
    const outro = await cenario(false, unidade.id);
    const senhaOutra = await senhaChamada(outro);
    const estudanteOutro = await estudante(outro);
    const salaOutra = await sala(outro);
    const supervisorOutro = await supervisor(outro);
    await comToken(api().get(rota(senhaOutra.id))).expect(404);
    const r = await sugerir(s.id);
    expect(JSON.stringify(r)).not.toContain(estudanteOutro);
    expect(JSON.stringify(r)).not.toContain(salaOutra);
    const supervisionada = await cenario();
    const semRecursos = await senhaChamada(supervisionada);
    const vazia = await sugerir(semRecursos.id);
    expect(JSON.stringify(vazia)).not.toContain(supervisorOutro);
    expect(vazia.supervisor.sugestao).toBeNull();
    expect(
      await contexto.prisma.fila.findUnique({ where: { id: supervisionada.filaId } }),
    ).toMatchObject({ bloqueada: false });
    expect(await contexto.prisma.senha.findUnique({ where: { id: semRecursos.id } })).toMatchObject(
      { status: 'CHAMADA', versao: 1 },
    );
    await comToken(api().get(rota((await senhaChamada(c, 'AGUARDANDO')).id))).expect(409);
    await comToken(api().get(rota((await senhaChamada(c, 'AGUARDANDO_RECURSO')).id))).expect(200);
  });
});
