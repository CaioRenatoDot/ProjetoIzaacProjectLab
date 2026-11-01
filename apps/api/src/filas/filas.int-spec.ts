import {
  type Chamada,
  type Fila,
  type Problema,
  type ProblemaValidacao,
  type QuadroFila,
  type ResultadoChamada,
  type SenhaResumo,
} from '@filas/contracts';
import { type PrismaClient, type Prioridade } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventosDominio, EventosDominioModule } from '../common/eventos/eventos-dominio';
import { IdempotenciaModule } from '../common/idempotencia/idempotencia.service';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { FilasModule } from './filas.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let atendente: SessaoDeTeste;
let pacienteId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = atendente) =>
  req.set('Authorization', `Bearer ${sessao.token}`);

/** Especialidade com fila ativa própria, para cada teste ter a fila isolada. */
async function novaFila(dados: { bloqueada?: boolean } = {}) {
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: unico('Especialidade'),
      exigeSupervisaoDocente: dados.bloqueada ?? false,
      unidadeId: UNIDADE_PADRAO,
      filas: {
        create: { unidadeId: UNIDADE_PADRAO, nome: 'Fila teste', letraSenha: 'T', ...dados },
      },
    },
    include: { filas: true },
  });
  return { especialidadeId: especialidade.id, filaId: especialidade.filas[0]!.id };
}

async function novaSenha(
  fila: { especialidadeId: string; filaId: string },
  prioridade: Prioridade = 'NORMAL',
  chegadaEm?: Date,
) {
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: atendente.usuarioId,
      especialidadeDestinoId: fila.especialidadeId,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade,
      motivo: 'Motivo ficticio',
      ...(prioridade === 'URGENTE' ? { justificativaClinica: 'Dor intensa' } : {}),
    },
  });
  return contexto.prisma.senha.create({
    data: {
      numero: `T${String(++seq % 1000).padStart(3, '0')}`,
      filaId: fila.filaId,
      triagemId: triagem.id,
      pacienteId,
      prioridade,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      ...(chegadaEm ? { chegadaEm } : {}),
    },
  });
}

const chamar = (filaId: string, chave?: string, dados: Record<string, unknown> = {}) => {
  const req = comToken(api().post(`/api/v1/filas/${filaId}/chamadas`));
  return (chave ? req.set('Idempotency-Key', chave) : req).send(dados);
};

describe('filas, quadro e chamada (#18)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, IdempotenciaModule, FilasModule],
    });
    atendente = await entrarComPermissoes(contexto, [
      'fila:consultar',
      'fila:criar',
      'fila:editar',
      'fila:excluir',
      'fila:chamar',
    ]);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Ana Souza'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1980-01-01'),
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

  describe('cadastro (RF-04)', () => {
    it('cria fila com a letra em maiúscula e recusa a segunda ativa da especialidade', async () => {
      const especialidade = await contexto.prisma.especialidade.create({
        data: { nome: unico('Psicologia'), unidadeId: UNIDADE_PADRAO },
      });
      const entrada = { nome: 'Psicologia', especialidadeId: especialidade.id, letraSenha: 'p' };

      const fila = corpo<Fila>(
        await comToken(api().post('/api/v1/filas')).send(entrada).expect(201),
      );
      const segunda = await comToken(api().post('/api/v1/filas')).send(entrada).expect(409);

      expect(fila).toMatchObject({
        letraSenha: 'P',
        ativa: true,
        slaMinutos: 25,
        toleranciaMinutos: 5,
        bloqueio: { ativo: false },
      });
      expect(corpo<Problema & { recursoExistenteId: string }>(segunda)).toMatchObject({
        codigo: 'DUPLICIDADE',
        recursoExistenteId: fila.id,
      });
      await comToken(api().post('/api/v1/filas'))
        .send({ ...entrada, ativa: false })
        .expect(201);
    });

    it('não exclui fila com senha e exclui fila sem senha', async () => {
      const comSenha = await novaFila();
      await novaSenha(comSenha);
      const semSenha = await novaFila();

      const resposta = await comToken(api().delete(`/api/v1/filas/${comSenha.filaId}`)).expect(409);
      await comToken(api().delete(`/api/v1/filas/${semSenha.filaId}`)).expect(204);

      expect(corpo<Problema>(resposta).codigo).toBe('VINCULO_ATIVO');
    });
  });

  it('RN-04 o quadro ordena por prioridade, chegada e agendamento, com métricas', async () => {
    const fila = await novaFila();
    const normal = await novaSenha(fila, 'NORMAL', new Date('2026-10-25T10:00:00Z'));
    const preferencial = await novaSenha(fila, 'PREFERENCIAL', new Date('2026-10-25T10:05:00Z'));
    const urgente = await novaSenha(fila, 'URGENTE', new Date('2026-10-25T10:10:00Z'));

    const quadro = corpo<QuadroFila>(
      await comToken(api().get(`/api/v1/filas/${fila.filaId}/senhas`)).expect(200),
    );

    expect(quadro.dados.map((s) => s.id)).toEqual([urgente.id, preferencial.id, normal.id]);
    expect(quadro.dados.map((s) => s.posicao)).toEqual([1, 2, 3]);
    expect(quadro.metricas).toMatchObject({ aguardando: 3, chamadas: 0, emAtendimento: 0 });
    expect(quadro.meta.total).toBe(3);
    const soChamadas = corpo<QuadroFila>(
      await comToken(api().get(`/api/v1/filas/${fila.filaId}/senhas?status=CHAMADA`)),
    );
    expect(soChamadas.dados).toEqual([]);
  });

  describe('chamar próxima (UC-09)', () => {
    it('RN-04 a urgente chegada depois de uma normal é chamada primeiro', async () => {
      const fila = await novaFila();
      await novaSenha(fila, 'NORMAL', new Date('2026-10-25T10:00:00Z'));
      const urgente = await novaSenha(fila, 'URGENTE', new Date('2026-10-25T10:30:00Z'));
      const ouvinte = vi.fn();
      const cancelar = contexto.app.get(EventosDominio).assinar('senha.chamada', ouvinte);

      const resposta = await chamar(fila.filaId, undefined, { localExibicao: 'Sala 03' }).expect(
        201,
      );
      cancelar();

      const resultado = corpo<ResultadoChamada>(resposta);
      expect(resultado).toMatchObject({
        senha: { id: urgente.id, status: 'CHAMADA', versao: 2 },
        chamada: { senhaId: urgente.id, sequencia: 1, local: 'Sala 03' },
        furouFilaPorUrgencia: true,
      });
      expect(resultado.senha.chamadaId).toBe(resultado.chamada.id);
      expect(
        Date.parse(resultado.toleranciaAte) - Date.parse(resultado.chamada.chamadoEm),
      ).toBeCloseTo(5 * 60_000, -3);
      const [evento] = ouvinte.mock.calls[0] as [{ chamada: Chamada }];
      expect(evento.chamada.id).toBe(resultado.chamada.id);
    });

    it('chamadas simultâneas na mesma fila recebem senhas diferentes', async () => {
      const fila = await novaFila();
      for (let i = 0; i < 6; i += 1) await novaSenha(fila);

      const respostas = await Promise.all(Array.from({ length: 6 }, () => chamar(fila.filaId)));

      expect(respostas.map((r) => r.status)).toEqual(Array(6).fill(201));
      const ids = respostas.map((r) => corpo<ResultadoChamada>(r).senha.id);
      expect(new Set(ids).size).toBe(6);
      await chamar(fila.filaId).expect(409);
    });

    it('fila sem senha aguardando volta 409 FILA_VAZIA; bloqueada, FILA_BLOQUEADA', async () => {
      const vazia = await novaFila();
      const bloqueada = await novaFila({ bloqueada: true });
      await novaSenha(bloqueada);

      expect(corpo<Problema>(await chamar(vazia.filaId).expect(409)).codigo).toBe('FILA_VAZIA');
      expect(corpo<Problema>(await chamar(bloqueada.filaId).expect(409)).codigo).toBe(
        'FILA_BLOQUEADA',
      );
    });

    it('a mesma Idempotency-Key devolve a mesma resposta e não chama outra senha', async () => {
      const fila = await novaFila();
      await novaSenha(fila);
      await novaSenha(fila);
      const chave = randomUUID();

      const primeira = corpo<ResultadoChamada>(await chamar(fila.filaId, chave).expect(201));
      const repetida = corpo<ResultadoChamada>(await chamar(fila.filaId, chave).expect(201));

      expect(repetida).toEqual(primeira);
      expect(
        await contexto.prisma.senha.count({ where: { filaId: fila.filaId, status: 'CHAMADA' } }),
      ).toBe(1);
    });

    it('a mesma Idempotency-Key em requisições simultâneas chama uma senha só', async () => {
      const fila = await novaFila();
      for (let i = 0; i < 3; i += 1) await novaSenha(fila);
      const chave = randomUUID();

      const respostas = await Promise.all(
        Array.from({ length: 3 }, () => chamar(fila.filaId, chave)),
      );

      expect(respostas.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(respostas.map((r) => corpo<ResultadoChamada>(r).senha.id)).size).toBe(1);
      expect(
        await contexto.prisma.senha.count({ where: { filaId: fila.filaId, status: 'CHAMADA' } }),
      ).toBe(1);
    });

    it('chave reaproveitada em outra operação ou fora do formato volta 422', async () => {
      const fila = await novaFila();
      const outra = await novaFila();
      await novaSenha(fila);
      await novaSenha(outra);
      const chave = randomUUID();
      await chamar(fila.filaId, chave).expect(201);

      const resposta = await chamar(outra.filaId, chave).expect(422);
      await chamar(outra.filaId, 'nao-e-uuid').expect(422);

      expect(corpo<ProblemaValidacao>(resposta).campos[0]?.campo).toBe('Idempotency-Key');
    });
  });

  describe('rechamada e cancelamento', () => {
    it('rechamada incrementa a sequência, renova a tolerância e a versão', async () => {
      const fila = await novaFila();
      await novaSenha(fila);
      const { chamada, senha } = corpo<ResultadoChamada>(await chamar(fila.filaId).expect(201));
      await contexto.prisma.senha.update({
        where: { id: senha.id },
        data: { toleranciaAte: new Date(Date.now() - 60_000) },
      });

      const nova = corpo<Chamada>(
        await comToken(api().post(`/api/v1/chamadas/${chamada.id}/rechamada`)).expect(201),
      );

      expect(nova).toMatchObject({ senhaId: senha.id, sequencia: 2, local: chamada.local });
      const depois = await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } });
      expect(depois.versao).toBe(senha.versao + 1);
      expect(depois.toleranciaAte!.getTime()).toBeGreaterThan(Date.now());
      await comToken(api().post(`/api/v1/chamadas/${chamada.id}/rechamada`)).expect(409);
    });

    it('cancelar devolve a senha a AGUARDANDO com a chegada original', async () => {
      const fila = await novaFila();
      const original = await novaSenha(fila, 'NORMAL', new Date('2026-10-25T09:00:00Z'));
      const { chamada } = corpo<ResultadoChamada>(await chamar(fila.filaId).expect(201));

      const senha = corpo<SenhaResumo>(
        await comToken(api().delete(`/api/v1/chamadas/${chamada.id}`)).expect(200),
      );

      expect(senha).toMatchObject({
        id: original.id,
        status: 'AGUARDANDO',
        chegadaEm: '2026-10-25T09:00:00.000Z',
        chamadaEm: null,
        chamadaId: null,
        posicao: 1,
      });
      await comToken(api().delete(`/api/v1/chamadas/${chamada.id}`)).expect(409);
      const novaChamada = corpo<ResultadoChamada>(await chamar(fila.filaId).expect(201));
      expect(novaChamada.chamada.sequencia).toBe(2);
    });
  });
});
