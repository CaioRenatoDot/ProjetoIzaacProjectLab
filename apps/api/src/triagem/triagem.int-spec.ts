import {
  type Especialidade,
  type ProblemaValidacao,
  type RespostaPaginada,
  type TriagemDetalhe,
  type TriagemResumo,
} from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CadastrosModule } from '../cadastros/cadastros.module';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { TriagemModule } from './triagem.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let triador: SessaoDeTeste;
let leitor: SessaoDeTeste;
let pacienteId: string;
let especialidadeId: string;
let semFilaId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = triador) =>
  req.set('Authorization', `Bearer ${sessao.token}`);

const triar = (dados: Record<string, unknown> = {}, sessao = triador) =>
  comToken(api().post('/api/v1/triagens'), sessao).send({
    pacienteId,
    especialidadeDestinoId: especialidadeId,
    tipoAtendimento: 'PRIMEIRA_CONSULTA',
    prioridade: 'NORMAL',
    motivo: 'Dor lombar ficticia',
    observacoes: 'Observacao ficticia',
    ...dados,
  });

describe('triagem (#15)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [TriagemModule, CadastrosModule] });
    triador = await entrarComPermissoes(contexto, [
      'triagem:criar',
      'triagem:consultar',
      'triagem:consultar_sensivel',
      'cadastros:consultar',
    ]);
    leitor = await entrarComPermissoes(contexto, ['triagem:consultar']);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Maria Aparecida da Silva'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1950-02-02'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
    especialidadeId = (
      await contexto.prisma.especialidade.create({
        data: {
          nome: unico('Fisioterapia'),
          unidadeId: UNIDADE_PADRAO,
          filas: {
            create: { unidadeId: UNIDADE_PADRAO, nome: 'Fisioterapia', letraSenha: 'F' },
          },
        },
      })
    ).id;
    semFilaId = (
      await contexto.prisma.especialidade.create({
        data: { nome: unico('Sem fila'), unidadeId: UNIDADE_PADRAO },
      })
    ).id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('RN-02 enquadramento IDOSO com prioridade NORMAL é salvo como PREFERENCIAL', async () => {
    const resposta = await triar({ enquadramentoLegal: 'IDOSO' }).expect(201);

    const triagem = corpo<TriagemDetalhe>(resposta);
    expect(triagem).toMatchObject({
      prioridade: 'PREFERENCIAL',
      enquadramentoLegal: 'IDOSO',
      especialidadeId,
      profissionalId: triador.usuarioId,
      senhaEmitida: false,
    });
    expect(triagem.pacienteIniciais).toMatch(/^M\. A\. S\. /);
  });

  it('RN-03 urgência sem justificativa clínica recebe 422 apontando o campo', async () => {
    const resposta = await triar({ prioridade: 'URGENTE' }).expect(422);

    expect(corpo<ProblemaValidacao>(resposta).campos.map((c) => c.campo)).toEqual([
      'justificativaClinica',
    ]);
  });

  it('recusa especialidade sem fila ativa e paciente inexistente com 422 no campo', async () => {
    const resposta = await triar({
      especialidadeDestinoId: semFilaId,
      pacienteId: '0190a000-0000-7000-8000-0000000000ff',
    }).expect(422);

    expect(corpo<ProblemaValidacao>(resposta).campos.map((c) => c.campo)).toEqual([
      'pacienteId',
      'especialidadeDestinoId',
    ]);
  });

  it('ADR-003 a listagem não traz motivo, justificativa, observações nem enquadramento', async () => {
    await triar({ prioridade: 'URGENTE', justificativaClinica: 'Dor intensa ficticia' }).expect(
      201,
    );

    const resposta = await comToken(
      api().get(`/api/v1/triagens?pacienteId=${pacienteId}`),
      leitor,
    ).expect(200);

    const { dados } = corpo<RespostaPaginada<TriagemResumo>>(resposta);
    expect(dados.length).toBeGreaterThan(0);
    for (const triagem of dados) {
      for (const campo of [
        'motivo',
        'justificativaClinica',
        'observacoes',
        'enquadramentoLegal',
        'pacienteNome',
      ]) {
        expect(triagem).not.toHaveProperty(campo);
      }
    }
    expect(resposta.text).not.toContain('Dor intensa ficticia');
  });

  it('filtra triagens em aberto e por período', async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const resposta = await comToken(
      api().get(
        `/api/v1/triagens?pacienteId=${pacienteId}&emAberto=true&de=2020-01-01&ate=2099-12-31`,
      ),
    ).expect(200);

    const { dados } = corpo<RespostaPaginada<TriagemResumo>>(resposta);
    expect(dados.every((t) => !t.senhaEmitida)).toBe(true);
    expect(dados.length).toBeGreaterThan(0);
    await comToken(api().get(`/api/v1/triagens?de=${hoje}&ate=2020-01-01`)).expect(422);
  });

  it('GET /triagens/{id} exige triagem:consultar_sensivel e grava CONSULTAR_SENSIVEL', async () => {
    const { id } = corpo<TriagemDetalhe>(await triar().expect(201));

    await comToken(api().get(`/api/v1/triagens/${id}`), leitor).expect(403);
    const resposta = await comToken(api().get(`/api/v1/triagens/${id}`)).expect(200);

    expect(corpo<TriagemDetalhe>(resposta)).toMatchObject({
      motivo: 'Dor lombar ficticia',
      observacoes: 'Observacao ficticia',
    });
    const registro = await contexto.prisma.auditLog.findFirst({
      where: { usuarioId: triador.usuarioId, entidadeId: id, operacao: 'CONSULTAR_SENSIVEL' },
    });
    expect(registro).toMatchObject({ modulo: 'triagem', entidade: 'triagem', sensivel: true });
  });

  it('especialidades com fila: filtro comFila e filasVinculadas reais', async () => {
    const resposta = await comToken(
      api().get('/api/v1/especialidades?comFila=true&tamanho=100'),
    ).expect(200);

    const ids = corpo<RespostaPaginada<Especialidade>>(resposta).dados.map((e) => e.id);
    expect(ids).toContain(especialidadeId);
    expect(ids).not.toContain(semFilaId);
    const detalhe = corpo<Especialidade>(
      await comToken(api().get(`/api/v1/especialidades/${especialidadeId}`)).expect(200),
    );
    expect(detalhe.filasVinculadas).toBe(1);
  });
});
