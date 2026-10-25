import { type IndicadoresResumo, type VolumePorEspecialidade } from '@filas/contracts';
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
import { IndicadoresModule } from './indicadores.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let gestao: SessaoDeTeste;
let especialidadeId: string;
let nomePaciente: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const em = (hora: string, dia = '2026-03-10') => new Date(`${dia}T${hora}:00-03:00`);
const get = (caminho: string) =>
  request(contexto.servidor).get(caminho).set('Authorization', `Bearer ${gestao.token}`);
const filtro = () => `de=2026-03-10&ate=2026-03-10&especialidadeId=${especialidadeId}`;

describe('indicadores agregados (#27)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [IndicadoresModule] });
    gestao = await entrarComPermissoes(contexto, ['indicadores:consultar', 'indicadores:exportar']);
    nomePaciente = unico('Lucia Prado');
    const pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: nomePaciente,
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1960-01-01'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
    const especialidade = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Indicadores'),
        unidadeId: UNIDADE_PADRAO,
        filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'I', letraSenha: 'I' } },
      },
      include: { filas: true },
    });
    especialidadeId = especialidade.id;
    const filaId = especialidade.filas[0]!.id;
    const estudanteId = (
      await contexto.prisma.estudante.create({
        data: { nome: unico('Estudante'), especialidadeId, nivelFormacao: '6º' },
      })
    ).id;
    const salaId = (
      await contexto.prisma.sala.create({
        data: { identificacao: unico('Sala'), unidadeId: UNIDADE_PADRAO },
      })
    ).id;

    const senha = async (status: 'ENCERRADO' | 'AUSENTE' | 'DESISTENCIA', chegadaEm: Date) => {
      const triagem = await contexto.prisma.triagem.create({
        data: {
          pacienteId,
          profissionalId: gestao.usuarioId,
          especialidadeDestinoId: especialidadeId,
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
          prioridade: 'NORMAL',
          motivo: 'Motivo ficticio',
        },
      });
      return contexto.prisma.senha.create({
        data: {
          numero: `I${String(++seq % 1000).padStart(3, '0')}`,
          filaId,
          triagemId: triagem.id,
          pacienteId,
          prioridade: 'NORMAL',
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
          status,
          chegadaEm,
        },
      });
    };
    const chamar = (senhaId: string, sequencia: number, chamadoEm: Date) =>
      contexto.prisma.chamada.create({
        data: { senhaId, usuarioId: gestao.usuarioId, localExibicao: 'Sala', sequencia, chamadoEm },
      });
    const atender = async (
      senhaId: string,
      inicio: Date,
      fim: Date,
      pausas: [Date, Date][] = [],
    ) => {
      const alocacao = await contexto.prisma.alocacao.create({
        data: { senhaId, estudanteId, salaId, confirmadaPor: gestao.usuarioId, liberadaEm: fim },
      });
      await contexto.prisma.atendimento.create({
        data: {
          senhaId,
          alocacaoId: alocacao.id,
          validacaoExigida: false,
          iniciadoEm: inicio,
          encerradoEm: fim,
          desfecho: 'ALTA',
          pausas: {
            create: pausas.map(([pausadoEm, retomadoEm]) => ({
              pausadoEm,
              retomadoEm,
              pausadoPor: gestao.usuarioId,
            })),
          },
        },
      });
    };

    // A: espera 10 (a rechamada não conta), 40 min de atendimento com 10 de pausa.
    const a = await senha('ENCERRADO', em('09:00'));
    await chamar(a.id, 1, em('09:10'));
    await chamar(a.id, 2, em('09:15'));
    await atender(a.id, em('09:20'), em('10:00'), [[em('09:30'), em('09:40')]]);
    // B: espera 30, 20 min de atendimento.
    const b = await senha('ENCERRADO', em('09:00'));
    await chamar(b.id, 1, em('09:30'));
    await atender(b.id, em('09:35'), em('09:55'));
    // C: espera 5 e ausência.
    const c = await senha('AUSENTE', em('09:00'));
    await chamar(c.id, 1, em('09:05'));
    await contexto.prisma.ausencia.create({ data: { senhaId: c.id, automatica: true } });
    // D: desistiu sem ser chamada.
    const d = await senha('DESISTENCIA', em('09:00'));
    await contexto.prisma.desistencia.create({
      data: { senhaId: d.id, origem: 'PACIENTE', registradoPor: gestao.usuarioId },
    });
    // Fora do período.
    await senha('DESISTENCIA', em('09:00', '2026-03-12'));
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('RF-10 agrega espera, atendimento descontando pausas, atendidos, ausência e desistências', async () => {
    const resumo = corpo<IndicadoresResumo>(
      await get(`/api/v1/indicadores/resumo?${filtro()}`).expect(200),
    );

    expect(resumo).toMatchObject({
      periodo: { de: '2026-03-10', ate: '2026-03-10' },
      tempoMedioEsperaMinutos: 15,
      tempoMedioAtendimentoMinutos: 25,
      pacientesAtendidos: 2,
      taxaAusencia: 33.3,
      desistencias: 1,
      semDados: false,
      amostraPequena: true,
      atendimentosPorEspecialidade: [{ especialidadeId, total: 2 }],
    });
  });

  it('RNF-02 a resposta não traz identificador de paciente', async () => {
    const resposta = await get(`/api/v1/indicadores/resumo?${filtro()}`).expect(200);

    expect(resposta.text).not.toContain(nomePaciente);
    expect(resposta.text).not.toMatch(/paciente(Id|Nome)/);
  });

  it('período ou turno sem movimento devolve semDados', async () => {
    const vazio = corpo<IndicadoresResumo>(
      await get(`/api/v1/indicadores/resumo?${filtro()}&turno=NOITE`).expect(200),
    );

    expect(vazio).toMatchObject({
      semDados: true,
      pacientesAtendidos: 0,
      tempoMedioEsperaMinutos: null,
      atendimentosPorEspecialidade: [],
    });
  });

  it('volume por especialidade traz atendimentos, ausências e desistências', async () => {
    const volume = corpo<VolumePorEspecialidade>(
      await get('/api/v1/indicadores/volume-por-especialidade?de=2026-03-10&ate=2026-03-10').expect(
        200,
      ),
    );

    expect(volume.series.find((s) => s.especialidadeId === especialidadeId)).toMatchObject({
      atendimentos: 2,
      ausencias: 1,
      desistencias: 1,
    });
  });

  it('exportação gera CSV e grava EXPORTAR com os filtros', async () => {
    const resposta = await get(`/api/v1/indicadores/exportacao?${filtro()}`).expect(200);

    const linhas = resposta.text.split('\n');
    expect(resposta.headers['content-type']).toContain('text/csv');
    expect(linhas[0]).toBe(
      'especialidade;senhas;tempoMedioEsperaMinutos;tempoMedioAtendimentoMinutos;pacientesAtendidos;taxaAusencia;ausencias;desistencias',
    );
    expect(linhas.at(-1)).toBe('Total;4;15;25;2;33.3;1;1');
    const registro = await contexto.prisma.auditLog.findFirst({
      where: { usuarioId: gestao.usuarioId, operacao: 'EXPORTAR' },
      orderBy: { ocorridoEm: 'desc' },
    });
    expect(registro).toMatchObject({ modulo: 'indicadores' });
    expect(registro?.justificativa).toContain(`especialidadeId=${especialidadeId}`);
  });

  it('exige o período e a permissão de exportar', async () => {
    await get('/api/v1/indicadores/resumo').expect(422);
    const leitor = await entrarComPermissoes(contexto, ['indicadores:consultar']);

    await request(contexto.servidor)
      .get(`/api/v1/indicadores/exportacao?${filtro()}`)
      .set('Authorization', `Bearer ${leitor.token}`)
      .expect(403);
  });
});
