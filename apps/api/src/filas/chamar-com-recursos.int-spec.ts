import { type Problema, type ProblemaValidacao, type ResultadoChamada } from '@filas/contracts';
import { type PrismaClient, type Prioridade, type StatusSenha } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SugestoesChamada } from '../alocacao/dto/sugestoes.dto';
import { EventosDominioModule } from '../common/eventos/eventos-dominio';
import { IdempotenciaModule } from '../common/idempotencia/idempotencia.service';
import { Relogio } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { FilasModule } from './filas.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

/** Segunda-feira, 10h00 no fuso da unidade: turno MANHA. */
const SEGUNDA_DE_MANHA = new Date('2026-10-26T10:00:00-03:00');
const NO_TURNO = { diaSemana: 'SEGUNDA', turno: 'MANHA' } as const;

let contexto: Contexto;
let atendente: SessaoDeTeste;
let soChama: SessaoDeTeste;
let pacienteId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = atendente) =>
  req.set('Authorization', `Bearer ${sessao.token}`);

interface Cenario {
  especialidadeId: string;
  filaId: string;
  recursoId: string;
}

async function cenario(exigeSupervisao = false): Promise<Cenario> {
  const recurso = await contexto.prisma.recurso.create({ data: { nome: unico('Balança') } });
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: unico('Nutrição'),
      unidadeId: UNIDADE_PADRAO,
      exigeSupervisaoDocente: exigeSupervisao,
      recursosExigidos: { create: { recursoId: recurso.id } },
      filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'Nutrição', letraSenha: 'N' } },
    },
    include: { filas: true },
  });
  return {
    especialidadeId: especialidade.id,
    filaId: especialidade.filas[0]!.id,
    recursoId: recurso.id,
  };
}

async function novaSenha(
  c: Cenario,
  prioridade: Prioridade = 'NORMAL',
  status: StatusSenha = 'AGUARDANDO',
) {
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: atendente.usuarioId,
      especialidadeDestinoId: c.especialidadeId,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade,
      motivo: 'Motivo ficticio',
    },
  });
  return contexto.prisma.senha.create({
    data: {
      numero: `N${String(++seq % 1000).padStart(3, '0')}`,
      filaId: c.filaId,
      triagemId: triagem.id,
      pacienteId,
      prioridade,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status,
    },
  });
}

const estudante = async (c: Cenario) =>
  (
    await contexto.prisma.estudante.create({
      data: {
        nome: unico('Estudante'),
        especialidadeId: c.especialidadeId,
        nivelFormacao: '7º período',
        disponibilidades: { create: NO_TURNO },
      },
    })
  ).id;

const sala = async (c: Cenario) =>
  contexto.prisma.sala.create({
    data: {
      identificacao: unico('Sala'),
      unidadeId: UNIDADE_PADRAO,
      recursos: { create: { recursoId: c.recursoId } },
    },
  });

const chamar = (filaId: string, dados: Record<string, unknown>, sessao = atendente) =>
  comToken(api().post(`/api/v1/filas/${filaId}/chamadas`), sessao).send(dados);

const statusDe = async (senhaId: string) =>
  (await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senhaId } })).status;

describe('chamar a próxima senha já com os recursos (#149)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, IdempotenciaModule, FilasModule],
    });
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockImplementation(() => SEGUNDA_DE_MANHA);
    atendente = await entrarComPermissoes(contexto, [
      'fila:consultar',
      'fila:chamar',
      'alocacao:consultar',
      'alocacao:criar',
    ]);
    soChama = await entrarComPermissoes(contexto, ['fila:consultar', 'fila:chamar']);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Bruna Dias'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1975-01-01'),
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

  it('a prévia traz a próxima senha pela RN-04 e as sugestões da especialidade, sem chamar', async () => {
    const c = await cenario();
    const normal = await novaSenha(c);
    const preferencial = await novaSenha(c, 'PREFERENCIAL');
    const estudanteId = await estudante(c);
    const { id: salaId } = await sala(c);

    const previa = SugestoesChamada.parse(
      corpo(await comToken(api().get(`/api/v1/filas/${c.filaId}/chamadas/sugestoes`)).expect(200)),
    );

    expect(previa.proxima).toEqual({ numero: preferencial.numero, prioridade: 'PREFERENCIAL' });
    expect(previa.estudante.sugestao).toMatchObject({ id: estudanteId, apto: true });
    expect(previa.sala.sugestao).toMatchObject({ id: salaId, apto: true });
    expect(previa.supervisor.aplicavel).toBe(false);
    expect([await statusDe(normal.id), await statusDe(preferencial.id)]).toEqual([
      'AGUARDANDO',
      'AGUARDANDO',
    ]);
  });

  it('chama já alocada, o telão recebe a sala e a alocação fica na auditoria', async () => {
    const c = await cenario();
    const senha = await novaSenha(c);
    const estudanteId = await estudante(c);
    const salaCriada = await sala(c);

    const resultado = corpo<ResultadoChamada>(
      await chamar(c.filaId, { alocacao: { estudanteId, salaId: salaCriada.id } }).expect(201),
    );

    expect(resultado.senha).toMatchObject({ id: senha.id, status: 'CHAMADA' });
    expect(resultado.chamada.local).toBe(salaCriada.identificacao);
    expect(resultado.alocacao).toMatchObject({
      senhaId: senha.id,
      estudante: { id: estudanteId },
      supervisor: null,
      sala: { id: salaCriada.id },
    });
    const vigente = await contexto.prisma.alocacao.findFirstOrThrow({
      where: { senhaId: senha.id, liberadaEm: null },
    });
    expect(
      await contexto.prisma.auditLog.count({
        where: { entidade: 'alocacao', entidadeId: vigente.id, operacao: 'CRIAR' },
      }),
    ).toBe(1);
  });

  it('RN-05 estudante ocupado entre a prévia e a confirmação: 409 e nenhuma senha é chamada', async () => {
    const c = await cenario();
    const ocupada = await novaSenha(c, 'NORMAL', 'CHAMADA');
    const estudanteId = await estudante(c);
    await contexto.prisma.alocacao.create({
      data: {
        senhaId: ocupada.id,
        estudanteId,
        salaId: (await sala(c)).id,
        confirmadaPor: atendente.usuarioId,
      },
    });
    const proxima = await novaSenha(c);

    const resposta = await chamar(c.filaId, {
      alocacao: { estudanteId, salaId: (await sala(c)).id },
    }).expect(409);

    expect(corpo<Problema>(resposta).codigo).toBe('RECURSO_INDISPONIVEL');
    expect(await statusDe(proxima.id)).toBe('AGUARDANDO');
    expect(await contexto.prisma.chamada.count({ where: { senhaId: proxima.id } })).toBe(0);
  });

  it('RN-07 especialidade com supervisão exige o supervisor; a senha continua aguardando', async () => {
    const c = await cenario(true);
    await contexto.prisma.supervisor.create({
      data: {
        nome: unico('Prof.'),
        limiteEstudantesSimultaneos: 3,
        especialidades: { create: { especialidadeId: c.especialidadeId } },
        disponibilidades: { create: NO_TURNO },
      },
    });
    const senha = await novaSenha(c);

    const resposta = await chamar(c.filaId, {
      alocacao: { estudanteId: await estudante(c), salaId: (await sala(c)).id },
    }).expect(422);

    expect(corpo<ProblemaValidacao>(resposta).campos.map((campo) => campo.campo)).toEqual([
      'supervisorId',
    ]);
    expect(await statusDe(senha.id)).toBe('AGUARDANDO');
  });

  it('levar recursos exige alocacao:criar; sem eles, a chamada simples segue como antes', async () => {
    const c = await cenario();
    const senha = await novaSenha(c);

    await chamar(
      c.filaId,
      { alocacao: { estudanteId: await estudante(c), salaId: (await sala(c)).id } },
      soChama,
    ).expect(403);
    expect(await statusDe(senha.id)).toBe('AGUARDANDO');

    const simples = corpo<ResultadoChamada>(await chamar(c.filaId, {}, soChama).expect(201));
    expect(simples.chamada.local).toBe('Nutrição');
    expect(simples.alocacao).toBeUndefined();
  });
});
