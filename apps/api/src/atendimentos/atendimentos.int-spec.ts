import {
  type AtendimentoDetalhe,
  type AtendimentoResumo,
  type EncerramentoResposta,
  type Problema,
  type ProblemaValidacao,
  type RespostaPaginada,
} from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventosDominioModule } from '../common/eventos/eventos-dominio';
import { Relogio, RelogioModule } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { AtendimentosModule } from './atendimentos.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let estudanteSessao: SessaoDeTeste;
let supervisorSessao: SessaoDeTeste;
let pacienteId: string;
let agora = new Date('2026-10-26T10:00:00-03:00');
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const como = (sessao: SessaoDeTeste, req: request.Test) =>
  req.set('Authorization', `Bearer ${sessao.token}`);
const minutos = (n: number) => {
  agora = new Date(agora.getTime() + n * 60_000);
};

/** Senha CHAMADA com estudante e sala alocados; a especialidade decide se exige validação. */
async function senhaAlocada(
  dados: { exigeValidacao?: boolean; situacaoSala?: 'EM_MANUTENCAO' } = {},
) {
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: unico('Especialidade'),
      unidadeId: UNIDADE_PADRAO,
      exigeValidacaoEncerramento: dados.exigeValidacao ?? false,
      filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'A', letraSenha: 'A' } },
    },
    include: { filas: true },
  });
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: estudanteSessao.usuarioId,
      especialidadeDestinoId: especialidade.id,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade: 'NORMAL',
      motivo: 'Motivo clinico ficticio',
    },
  });
  const senha = await contexto.prisma.senha.create({
    data: {
      numero: `A${String(++seq % 1000).padStart(3, '0')}`,
      filaId: especialidade.filas[0]!.id,
      triagemId: triagem.id,
      pacienteId,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status: 'CHAMADA',
    },
  });
  const alocacao = await contexto.prisma.alocacao.create({
    data: {
      senhaId: senha.id,
      estudanteId: (
        await contexto.prisma.estudante.create({
          data: {
            nome: unico('Estudante'),
            especialidadeId: especialidade.id,
            nivelFormacao: '8º',
          },
        })
      ).id,
      salaId: (
        await contexto.prisma.sala.create({
          data: {
            identificacao: unico('Sala'),
            unidadeId: UNIDADE_PADRAO,
            ...(dados.situacaoSala ? { situacao: dados.situacaoSala } : {}),
          },
        })
      ).id,
      confirmadaPor: estudanteSessao.usuarioId,
    },
  });
  return { senhaId: senha.id, especialidadeId: especialidade.id, alocacaoId: alocacao.id };
}

const iniciar = (senhaId: string, versao = 1) =>
  como(estudanteSessao, api().post(`/api/v1/senhas/${senhaId}/atendimento`)).send({ versao });
const acao = (
  id: string,
  nome: string,
  corpoReq: Record<string, unknown>,
  sessao = estudanteSessao,
) => como(sessao, api().post(`/api/v1/atendimentos/${id}/${nome}`)).send(corpoReq);

describe('ciclo do atendimento (#23)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, RelogioModule, AtendimentosModule],
    });
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockImplementation(() => agora);
    estudanteSessao = await entrarComPermissoes(contexto, [
      'atendimento:consultar',
      'atendimento:criar',
      'atendimento:editar',
    ]);
    supervisorSessao = await entrarComPermissoes(contexto, [
      'atendimento:validar',
      'atendimento:consultar_sensivel',
    ]);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Rita Alves'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1965-01-01'),
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

  it('RN-11 com validação exigida: encerrar vai a PENDENTE_VALIDACAO e validar a ENCERRADO', async () => {
    const { senhaId, alocacaoId } = await senhaAlocada({ exigeValidacao: true });
    const iniciado = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));
    expect(iniciado).toMatchObject({ status: 'EM_ATENDIMENTO', exigeValidacao: true, versao: 2 });

    const encerrado = corpo<EncerramentoResposta>(
      await acao(iniciado.id, 'encerramento', { desfecho: 'ALTA', versao: 2 }).expect(200),
    );
    expect(encerrado).toMatchObject({
      atendimento: { status: 'PENDENTE_VALIDACAO', desfecho: 'ALTA' },
      exigeValidacao: true,
      exigeEncaminhamento: false,
    });
    expect(
      (await contexto.prisma.alocacao.findUniqueOrThrow({ where: { id: alocacaoId } })).liberadaEm,
    ).not.toBeNull();

    const validado = corpo<AtendimentoResumo>(
      await acao(iniciado.id, 'validacao', { aprovado: true, versao: 3 }, supervisorSessao).expect(
        200,
      ),
    );
    expect(validado).toMatchObject({ status: 'ENCERRADO', versao: 4 });
    const banco = await contexto.prisma.atendimento.findUniqueOrThrow({
      where: { id: iniciado.id },
    });
    expect(banco.validadoPor).toBe(supervisorSessao.usuarioId);
  });

  it('RN-11 recusa mantém PENDENTE_VALIDACAO com o parecer e aceita o reenvio', async () => {
    const { senhaId } = await senhaAlocada({ exigeValidacao: true });
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));
    await acao(id, 'encerramento', { desfecho: 'ALTA', versao: 2 }).expect(200);

    await acao(id, 'validacao', { aprovado: false, versao: 3 }, supervisorSessao).expect(422);
    const recusado = corpo<AtendimentoResumo>(
      await acao(
        id,
        'validacao',
        { aprovado: false, parecer: 'Revisar a conduta', versao: 3 },
        supervisorSessao,
      ).expect(200),
    );
    expect(recusado).toMatchObject({ status: 'PENDENTE_VALIDACAO', versao: 4 });
    expect(
      (await contexto.prisma.atendimento.findUniqueOrThrow({ where: { id } })).parecerSupervisor,
    ).toBe('Revisar a conduta');

    const reenviado = corpo<EncerramentoResposta>(
      await acao(id, 'encerramento', { desfecho: 'RETORNO_AGENDADO', versao: 4 }).expect(200),
    );
    expect(reenviado.atendimento).toMatchObject({
      status: 'PENDENTE_VALIDACAO',
      desfecho: 'RETORNO_AGENDADO',
      versao: 5,
    });
    await acao(id, 'validacao', { aprovado: true, versao: 5 }, supervisorSessao).expect(200);
  });

  it('sem validação exigida encerra direto e sinaliza o encaminhamento', async () => {
    const { senhaId } = await senhaAlocada();
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));

    const resposta = corpo<EncerramentoResposta>(
      await acao(id, 'encerramento', { desfecho: 'ENCAMINHAMENTO_INTERNO', versao: 2 }).expect(200),
    );

    expect(resposta).toMatchObject({
      atendimento: { status: 'ENCERRADO' },
      exigeValidacao: false,
      exigeEncaminhamento: true,
    });
    await acao(id, 'validacao', { aprovado: true, versao: 3 }, supervisorSessao).expect(409);
  });

  it('encerramento sem desfecho recebe 422 DESFECHO_OBRIGATORIO', async () => {
    const { senhaId } = await senhaAlocada();
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));

    const resposta = await acao(id, 'encerramento', { versao: 2 }).expect(422);

    expect(corpo<ProblemaValidacao>(resposta)).toMatchObject({
      codigo: 'DESFECHO_OBRIGATORIO',
      campos: [{ campo: 'desfecho' }],
    });
  });

  it('duas pausas geram duas linhas com início e fim e o tempo desconta as pausas', async () => {
    const { senhaId } = await senhaAlocada();
    agora = new Date('2026-10-26T10:00:00-03:00');
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));
    minutos(10);
    await acao(id, 'pausa', { motivo: 'Exame', versao: 2 }).expect(200);
    minutos(5);
    await acao(id, 'retomada', { versao: 3 }).expect(200);
    minutos(10);
    await acao(id, 'pausa', { versao: 4 }).expect(200);
    await acao(id, 'encerramento', { desfecho: 'ALTA', versao: 5 }).expect(409);
    minutos(5);
    await acao(id, 'retomada', { versao: 5 }).expect(200);
    minutos(10);

    const encerrado = corpo<EncerramentoResposta>(
      await acao(id, 'encerramento', { desfecho: 'ALTA', versao: 6 }).expect(200),
    );

    const pausas = await contexto.prisma.pausaAtendimento.findMany({
      where: { atendimentoId: id },
    });
    expect(pausas).toHaveLength(2);
    expect(pausas.every((pausa) => pausa.retomadoEm !== null)).toBe(true);
    expect(encerrado.atendimento.duracaoMinutos).toBe(30);
  });

  it('não inicia sem alocação nem com a sala indisponível', async () => {
    const semAlocacao = await senhaAlocada();
    await contexto.prisma.alocacao.update({
      where: { id: semAlocacao.alocacaoId },
      data: { liberadaEm: new Date() },
    });
    const salaFora = await senhaAlocada({ situacaoSala: 'EM_MANUTENCAO' });

    expect(corpo<Problema>(await iniciar(semAlocacao.senhaId).expect(409)).codigo).toBe(
      'TRANSICAO_INVALIDA',
    );
    expect(corpo<Problema>(await iniciar(salaFora.senhaId).expect(409)).codigo).toBe(
      'RECURSO_INDISPONIVEL',
    );
  });

  it('RN-11 a validação exigida é a copiada no início, mesmo se o cadastro mudar', async () => {
    const { senhaId, especialidadeId } = await senhaAlocada({ exigeValidacao: true });
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));
    await contexto.prisma.especialidade.update({
      where: { id: especialidadeId },
      data: { exigeValidacaoEncerramento: false },
    });

    const resposta = corpo<EncerramentoResposta>(
      await acao(id, 'encerramento', { desfecho: 'ALTA', versao: 2 }).expect(200),
    );

    expect(resposta.atendimento.status).toBe('PENDENTE_VALIDACAO');
  });

  it('a lista não traz observações; o detalhe exige a permissão sensível e grava CONSULTAR_SENSIVEL', async () => {
    const { senhaId } = await senhaAlocada();
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));
    await acao(id, 'encerramento', {
      desfecho: 'ALTA',
      observacoes: 'Observacao clinica ficticia',
      versao: 2,
    }).expect(200);

    const lista = await como(
      estudanteSessao,
      api().get('/api/v1/atendimentos?status=ENCERRADO'),
    ).expect(200);
    expect(lista.text).not.toContain('Observacao clinica ficticia');
    expect(corpo<RespostaPaginada<AtendimentoResumo>>(lista).dados[0]).not.toHaveProperty(
      'observacoes',
    );

    await como(estudanteSessao, api().get(`/api/v1/atendimentos/${id}`)).expect(403);
    const detalhe = corpo<AtendimentoDetalhe>(
      await como(supervisorSessao, api().get(`/api/v1/atendimentos/${id}`)).expect(200),
    );
    expect(detalhe).toMatchObject({
      observacoes: 'Observacao clinica ficticia',
      triagem: { motivo: 'Motivo clinico ficticio' },
    });
    expect(
      await contexto.prisma.auditLog.count({
        where: {
          entidadeId: id,
          operacao: 'CONSULTAR_SENSIVEL',
          usuarioId: supervisorSessao.usuarioId,
        },
      }),
    ).toBe(1);
  });

  it('validar exige atendimento:validar', async () => {
    const { senhaId } = await senhaAlocada({ exigeValidacao: true });
    const { id } = corpo<AtendimentoResumo>(await iniciar(senhaId).expect(201));
    await acao(id, 'encerramento', { desfecho: 'ALTA', versao: 2 }).expect(200);

    await acao(id, 'validacao', { aprovado: true, versao: 3 }).expect(403);
  });
});
