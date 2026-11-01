import {
  type ParametrosVigentes,
  type Problema,
  type ProblemaValidacao,
  type Reclassificacao,
  type ReclassificacaoResposta,
  type SenhaDetalhe,
  type SenhaEmitida,
  type SenhaResumo,
} from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventosDominio, EventosDominioModule } from '../common/eventos/eventos-dominio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { ParametrosModule } from '../parametros/parametros.module';
import { SenhasModule } from './senhas.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let atendente: SessaoDeTeste;
let semSensivel: SessaoDeTeste;
let usuarioId: string;
let pacienteId: string;
let especialidadeId: string;
let filaId: string;
let semFilaId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = atendente) =>
  req.set('Authorization', `Bearer ${sessao.token}`);
const JUSTIFICATIVA = 'Piora do quadro relatada na recepcao';

const novaTriagem = async (dados: Record<string, unknown> = {}) =>
  (
    await contexto.prisma.triagem.create({
      data: {
        pacienteId,
        profissionalId: usuarioId,
        especialidadeDestinoId: especialidadeId,
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        prioridade: 'NORMAL',
        motivo: 'Motivo clinico ficticio',
        ...dados,
      },
    })
  ).id;

/** Emite a senha; com `status`, confere o código da resposta. */
const emitir = async (dados: Record<string, unknown> = {}, status?: number) => {
  const triagemId = (dados.triagemId as string | undefined) ?? (await novaTriagem());
  const resposta = await comToken(api().post('/api/v1/senhas')).send({ ...dados, triagemId });
  if (status) expect(resposta.status).toBe(status);
  return resposta;
};

describe('emissão e reclassificação de senha (#16)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, ParametrosModule, SenhasModule],
    });
    atendente = await entrarComPermissoes(contexto, [
      'senha:criar',
      'senha:consultar',
      'senha:reclassificar',
      'triagem:consultar_sensivel',
    ]);
    semSensivel = await entrarComPermissoes(contexto, ['senha:consultar']);
    usuarioId = atendente.usuarioId;
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Joao Pereira'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1990-01-01'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
    especialidadeId = (
      await contexto.prisma.especialidade.create({
        data: { nome: unico('Fisioterapia'), unidadeId: UNIDADE_PADRAO },
      })
    ).id;
    filaId = (
      await contexto.prisma.fila.create({
        data: { especialidadeId, unidadeId: UNIDADE_PADRAO, nome: 'Fisio', letraSenha: 'F' },
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

  it('RN-04 emite no formato F001, AGUARDANDO, com a prioridade da triagem e o evento', async () => {
    const ouvinte = vi.fn();
    const cancelar = contexto.app.get(EventosDominio).assinar('senha.criada', ouvinte);

    const resposta = await emitir({}, 201);
    cancelar();

    const senha = corpo<SenhaEmitida>(resposta);
    expect(senha.numero).toMatch(/^F\d{3,}$/);
    expect(senha).toMatchObject({
      status: 'AGUARDANDO',
      prioridade: 'NORMAL',
      filaId,
      versao: 1,
      avisos: [],
    });
    expect(senha.posicaoEstimada).toBeGreaterThan(0);
    expect(ouvinte).toHaveBeenCalledWith(expect.objectContaining({ id: senha.id }));
  });

  it('duas emissões simultâneas na mesma fila não repetem número', async () => {
    const respostas = await Promise.all(Array.from({ length: 8 }, () => emitir()));

    const numeros = respostas.map((r) => corpo<SenhaEmitida>(r).numero);
    expect(respostas.every((r) => r.status === 201)).toBe(true);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('triagem que já gerou senha volta 409 DUPLICIDADE com a senha existente', async () => {
    const triagemId = await novaTriagem();
    const { id } = corpo<SenhaEmitida>(
      await comToken(api().post('/api/v1/senhas')).send({ triagemId }).expect(201),
    );

    const resposta = await comToken(api().post('/api/v1/senhas')).send({ triagemId }).expect(409);

    expect(corpo<Problema & { recursoExistenteId: string }>(resposta)).toMatchObject({
      codigo: 'DUPLICIDADE',
      recursoExistenteId: id,
    });
  });

  it('especialidade sem fila ativa volta 409 SEM_FILA_CONFIGURADA com o próximo passo', async () => {
    const resposta = await emitir(
      {
        triagemId: await novaTriagem({ especialidadeDestinoId: semFilaId }),
      },
      409,
    );

    expect(corpo<Problema>(resposta)).toMatchObject({ codigo: 'SEM_FILA_CONFIGURADA' });
    expect(corpo<Problema>(resposta).detail).toMatch(/administração/);
  });

  it('RN-10 fila bloqueada emite com o aviso FILA_BLOQUEADA', async () => {
    const outra = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Bloqueada'),
        unidadeId: UNIDADE_PADRAO,
        filas: {
          create: { unidadeId: UNIDADE_PADRAO, nome: 'B', letraSenha: 'B', bloqueada: true },
        },
      },
    });

    const resposta = await emitir(
      {
        triagemId: await novaTriagem({ especialidadeDestinoId: outra.id }),
      },
      201,
    );

    expect(corpo<SenhaEmitida>(resposta).avisos.map((a) => a.codigo)).toEqual(['FILA_BLOQUEADA']);
  });

  it('RN-04 ordena por prioridade, chegada e agendamento prévio', async () => {
    const outra = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Ordem'),
        unidadeId: UNIDADE_PADRAO,
        filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'O', letraSenha: 'O' } },
      },
    });
    const triagem = (prioridade: string) =>
      novaTriagem({ especialidadeDestinoId: outra.id, prioridade });
    const normal = corpo<SenhaEmitida>(await emitir({ triagemId: await triagem('NORMAL') }));
    const preferencial = corpo<SenhaEmitida>(
      await emitir({ triagemId: await triagem('PREFERENCIAL') }),
    );
    const urgente = corpo<SenhaEmitida>(
      await emitir({
        triagemId: await novaTriagem({
          especialidadeDestinoId: outra.id,
          prioridade: 'URGENTE',
          justificativaClinica: 'Dor intensa',
        }),
      }),
    );
    const posicao = async (id: string) =>
      corpo<SenhaResumo>(await comToken(api().get(`/api/v1/senhas/${id}`)).expect(200)).posicao;

    expect(urgente.posicaoEstimada).toBe(1);
    expect(await posicao(urgente.id)).toBe(1);
    expect(await posicao(preferencial.id)).toBe(2);
    expect(await posicao(normal.id)).toBe(3);

    // Mesma prioridade e mesma chegada: o agendamento prévio desempata.
    const chegada = new Date('2026-10-25T13:00:00Z');
    const [a, b] = [corpo<SenhaEmitida>(await emitir()), corpo<SenhaEmitida>(await emitir())];
    await contexto.prisma.senha.update({ where: { id: a.id }, data: { chegadaEm: chegada } });
    await contexto.prisma.senha.update({
      where: { id: b.id },
      data: { chegadaEm: chegada, temAgendamentoPrevio: true },
    });
    expect(await posicao(b.id)).toBeLessThan((await posicao(a.id))!);
  });

  describe('reclassificação (RN-01)', () => {
    it('RN-01 justificativa abaixo do mínimo volta 422 JUSTIFICATIVA_OBRIGATORIA', async () => {
      const senha = corpo<SenhaEmitida>(await emitir());

      const resposta = await comToken(api().patch(`/api/v1/senhas/${senha.id}/prioridade`))
        .send({ prioridade: 'URGENTE', justificativa: 'curta', versao: senha.versao })
        .expect(422);

      expect(corpo<ProblemaValidacao & { minimo: number }>(resposta)).toMatchObject({
        codigo: 'JUSTIFICATIVA_OBRIGATORIA',
        minimo: 20,
        campos: [{ campo: 'justificativa' }],
      });
      await comToken(api().patch(`/api/v1/senhas/${senha.id}/prioridade`))
        .send({ prioridade: 'URGENTE', versao: senha.versao })
        .expect(422);
    });

    it('versão desatualizada volta 409 VERSAO_DESATUALIZADA com o estado atual', async () => {
      const senha = corpo<SenhaEmitida>(await emitir());
      await comToken(api().patch(`/api/v1/senhas/${senha.id}/prioridade`))
        .send({ prioridade: 'PREFERENCIAL', justificativa: JUSTIFICATIVA, versao: 1 })
        .expect(200);

      const resposta = await comToken(api().patch(`/api/v1/senhas/${senha.id}/prioridade`))
        .send({ prioridade: 'URGENTE', justificativa: JUSTIFICATIVA, versao: 1 })
        .expect(409);

      expect(corpo<Problema & { atual: SenhaResumo }>(resposta)).toMatchObject({
        codigo: 'VERSAO_DESATUALIZADA',
        atual: { id: senha.id, versao: 2, prioridade: 'PREFERENCIAL' },
      });
    });

    it('RN-01 grava no histórico e no audit_log com a justificativa', async () => {
      const senha = corpo<SenhaEmitida>(await emitir());

      const resposta = await comToken(api().patch(`/api/v1/senhas/${senha.id}/prioridade`))
        .send({ prioridade: 'URGENTE', justificativa: JUSTIFICATIVA, versao: senha.versao })
        .expect(200);

      expect(corpo<ReclassificacaoResposta>(resposta)).toMatchObject({
        senha: { prioridade: 'URGENTE', versao: 2 },
        novaPosicao: 1,
      });
      const historico = corpo<Reclassificacao[]>(
        await comToken(api().get(`/api/v1/senhas/${senha.id}/reclassificacoes`)).expect(200),
      );
      expect(historico).toEqual([
        expect.objectContaining({
          dePrioridade: 'NORMAL',
          paraPrioridade: 'URGENTE',
          justificativa: JUSTIFICATIVA,
        }),
      ]);
      const auditoria = await contexto.prisma.auditLog.findFirst({
        where: { entidadeId: senha.id, operacao: 'EDITAR' },
      });
      expect(auditoria).toMatchObject({ modulo: 'senha', justificativa: JUSTIFICATIVA });
    });

    it('senha já em atendimento não é reclassificada', async () => {
      const senha = corpo<SenhaEmitida>(await emitir());
      await contexto.prisma.senha.update({
        where: { id: senha.id },
        data: { status: 'EM_ATENDIMENTO' },
      });

      const resposta = await comToken(api().patch(`/api/v1/senhas/${senha.id}/prioridade`))
        .send({ prioridade: 'URGENTE', justificativa: JUSTIFICATIVA, versao: senha.versao })
        .expect(409);

      expect(corpo<Problema>(resposta).codigo).toBe('TRANSICAO_INVALIDA');
    });
  });

  describe('consulta', () => {
    it('sem incluirTriagem devolve o resumo sem conteúdo clínico e sem auditoria', async () => {
      const senha = corpo<SenhaEmitida>(await emitir());

      const resposta = await comToken(api().get(`/api/v1/senhas/${senha.id}`), semSensivel).expect(
        200,
      );

      expect(resposta.body).not.toHaveProperty('triagem');
      expect(resposta.text).not.toContain('Motivo clinico ficticio');
      expect(
        await contexto.prisma.auditLog.count({
          where: { entidadeId: senha.id, operacao: 'CONSULTAR_SENSIVEL' },
        }),
      ).toBe(0);
    });

    it('incluirTriagem exige triagem:consultar_sensivel e grava CONSULTAR_SENSIVEL', async () => {
      const senha = corpo<SenhaEmitida>(await emitir());

      await comToken(
        api().get(`/api/v1/senhas/${senha.id}?incluirTriagem=true`),
        semSensivel,
      ).expect(403);
      const resposta = await comToken(
        api().get(`/api/v1/senhas/${senha.id}?incluirTriagem=true`),
      ).expect(200);

      expect(corpo<SenhaDetalhe>(resposta)).toMatchObject({
        pacienteId,
        alocacao: null,
        triagem: { motivo: 'Motivo clinico ficticio' },
      });
      const registros = await contexto.prisma.auditLog.findMany({
        where: { entidadeId: senha.id, operacao: 'CONSULTAR_SENSIVEL' },
      });
      expect(registros).toHaveLength(1);
      expect(registros[0]).toMatchObject({
        usuarioId: atendente.usuarioId,
        modulo: 'triagem',
        sensivel: true,
      });
    });

    it('GET /parametros devolve os valores em vigor, com sobreposição da especialidade', async () => {
      await contexto.prisma.parametroUnidade.create({
        data: {
          unidadeId: UNIDADE_PADRAO,
          especialidadeId,
          chave: 'JUSTIFICATIVA_MIN_CARACTERES',
          valor: 30,
        },
      });

      const geral = corpo<ParametrosVigentes>(
        await comToken(api().get('/api/v1/parametros'), semSensivel).expect(200),
      );
      const daEspecialidade = corpo<ParametrosVigentes>(
        await comToken(
          api().get(`/api/v1/parametros?especialidadeId=${especialidadeId}`),
          semSensivel,
        ).expect(200),
      );

      expect(geral.justificativaMinCaracteres).toBe(20);
      expect(daEspecialidade).toMatchObject({ justificativaMinCaracteres: 30, slaMinutos: 25 });
    });
  });
});
