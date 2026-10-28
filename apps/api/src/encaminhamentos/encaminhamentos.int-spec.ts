import {
  Encaminhamento,
  type Desfecho,
  type EncerramentoResposta,
  type Problema,
  type Prioridade,
  type AtendimentoResumo,
} from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AtendimentosModule } from '../atendimentos/atendimentos.module';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { RelogioModule } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { SenhasRepository } from '../senhas/senhas.repository';
import { EncaminhamentosModule } from './encaminhamentos.module';

let contexto: AppDeTeste & { prisma: PrismaClient };
let autor: SessaoDeTeste;
const api = () => request(contexto.servidor);
const como = (r: request.Test) => r.auth(autor.token, { type: 'bearer' });
const corpo = <T>(r: request.Response) => r.body as T;
const unico = () => randomUUID();

async function especialidade(
  dados: {
    ativo?: boolean;
    bloqueada?: boolean;
    comFila?: boolean;
    unidadeId?: string;
    validacao?: boolean;
  } = {},
) {
  const unidadeId = dados.unidadeId ?? UNIDADE_PADRAO;
  return contexto.prisma.especialidade.create({
    data: {
      nome: `Especialidade fictícia ${unico()}`,
      unidadeId,
      ativo: dados.ativo ?? true,
      exigeValidacaoEncerramento: dados.validacao ?? false,
      ...(dados.comFila === false
        ? {}
        : {
            filas: {
              create: {
                unidadeId,
                nome: 'Fila fictícia',
                letraSenha: 'D',
                bloqueada: dados.bloqueada ?? false,
              },
            },
          }),
    },
    include: { filas: true },
  });
}

async function origem(
  dados: {
    desfecho?: Desfecho;
    validacao?: boolean;
    prioridade?: Prioridade;
    legal?: boolean;
  } = {},
) {
  const esp = await especialidade({ validacao: dados.validacao });
  const paciente = await contexto.prisma.paciente.create({
    data: {
      nomeCompleto: 'Paciente Fictício Sigiloso',
      documento: unico(),
      dataNascimento: new Date('1940-01-01'),
      vinculo: 'EXTERNO',
      unidadeId: UNIDADE_PADRAO,
    },
  });
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId: paciente.id,
      profissionalId: autor.usuarioId,
      especialidadeDestinoId: esp.id,
      tipoAtendimento: 'RETORNO',
      prioridade: dados.prioridade ?? 'NORMAL',
      motivo: 'Motivo clínico sigiloso',
      observacoes: 'Observação sigilosa',
      justificativaClinica:
        dados.prioridade === 'URGENTE' ? 'Justificativa clínica original' : null,
      enquadramentoLegal: dados.legal ? 'IDOSO' : null,
    },
  });
  const senha = await contexto.prisma.senha.create({
    data: {
      numero: `O${unico()}`,
      filaId: esp.filas[0]!.id,
      triagemId: triagem.id,
      pacienteId: paciente.id,
      prioridade: dados.prioridade ?? 'NORMAL',
      tipoAtendimento: 'RETORNO',
      status: 'CHAMADA',
    },
  });
  const estudante = await contexto.prisma.estudante.create({
    data: { nome: `Estudante ${unico()}`, especialidadeId: esp.id, nivelFormacao: '7º período' },
  });
  const sala = await contexto.prisma.sala.create({
    data: { identificacao: unico(), unidadeId: UNIDADE_PADRAO },
  });
  await contexto.prisma.alocacao.create({
    data: {
      senhaId: senha.id,
      estudanteId: estudante.id,
      salaId: sala.id,
      confirmadaPor: autor.usuarioId,
    },
  });
  const atendimento = corpo<AtendimentoResumo>(
    await como(api().post(`/api/v1/senhas/${senha.id}/atendimento`))
      .send({ versao: 1 })
      .expect(201),
  );
  const encerrado = corpo<EncerramentoResposta>(
    await como(api().post(`/api/v1/atendimentos/${atendimento.id}/encerramento`))
      .send({ versao: atendimento.versao, desfecho: dados.desfecho ?? 'ENCAMINHAMENTO_INTERNO' })
      .expect(200),
  );
  return { atendimento: encerrado.atendimento, senha, triagem };
}

const registrar = (id: string, entrada: object) =>
  como(api().post(`/api/v1/atendimentos/${id}/encaminhamentos`)).send(entrada);

describe('encaminhamentos #26 (HTTP e PostgreSQL reais)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [RelogioModule, EncaminhamentosModule, AtendimentosModule],
    });
    autor = await entrarComPermissoes(contexto, [
      'encaminhamento:criar',
      'atendimento:criar',
      'atendimento:editar',
      'atendimento:validar',
    ]);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('UC-14 gera AGUARDANDO na fila de destino, mantém triagem e emite resumo somente após commit', async () => {
    const c = await origem();
    const destino = await especialidade();
    let transacaoConcluida = false;
    let eventoAposCommit = false;
    const repositorioSenhas = contexto.app.get(SenhasRepository);
    const transacionar = repositorioSenhas.transacao.bind(repositorioSenhas);
    vi.spyOn(repositorioSenhas, 'transacao').mockImplementation(async (trabalho) => {
      const resultado = await transacionar(trabalho);
      transacaoConcluida = true;
      return resultado;
    });
    let persistido: Promise<number> | undefined;
    const capturados: unknown[] = [];
    const desligar = contexto.app.get(EventosDominio).assinar('senha.criada', (s) => {
      capturados.push(s);
      eventoAposCommit = transacaoConcluida;
      persistido = contexto.prisma.encaminhamento
        .count({ where: { senhaGeradaId: s.id } })
        .then((total) => total);
    });
    try {
      const r = Encaminhamento.parse(
        (
          await registrar(c.atendimento.id, {
            tipo: 'INTERNO',
            especialidadeDestinoId: destino.id,
          }).expect(201)
        ).body,
      );
      expect(r.senhaGerada).toMatchObject({
        status: 'AGUARDANDO',
        filaId: destino.filas[0]!.id,
        tipoAtendimento: 'RETORNO',
        numero: 'D001',
      });
      const nova = await contexto.prisma.senha.findUniqueOrThrow({
        where: { id: r.senhaGerada!.id },
      });
      expect(nova).toMatchObject({
        senhaOrigemId: c.senha.id,
        triagemId: c.triagem.id,
        pacienteId: c.senha.pacienteId,
      });
      expect(await contexto.prisma.triagem.findUnique({ where: { id: c.triagem.id } })).toEqual(
        c.triagem,
      );
      expect(await persistido).toBe(1);
      expect(eventoAposCommit).toBe(true);
      expect(capturados).toHaveLength(1);
      expect(JSON.stringify(capturados)).not.toMatch(
        /sigiloso|pacienteNome|justificativaClinica|observacoes/,
      );
      expect(r.motivo).toBe('');
    } finally {
      desligar();
    }
  });

  it('UC-14 especialidade inativa ou inexistente retorna ESPECIALIDADE_INATIVA sem gerar senha', async () => {
    const c = await origem();
    const destino = await especialidade({ ativo: false });
    for (const id of [destino.id, unico()]) {
      const r = await registrar(c.atendimento.id, {
        tipo: 'INTERNO',
        especialidadeDestinoId: id,
      }).expect(409);
      expect(corpo<Problema>(r).codigo).toBe('ESPECIALIDADE_INATIVA');
    }
    expect(await contexto.prisma.senha.count({ where: { senhaOrigemId: c.senha.id } })).toBe(0);
    const semFila = await especialidade({ comFila: false });
    expect(
      corpo<Problema>(
        await registrar(c.atendimento.id, {
          tipo: 'INTERNO',
          especialidadeDestinoId: semFila.id,
        }).expect(409),
      ).codigo,
    ).toBe('SEM_FILA_CONFIGURADA');
  });

  it('UC-15 externo grava instituição, motivo e observações sem criar senha; auditoria é única', async () => {
    const c = await origem({ desfecho: 'ENCAMINHAMENTO_EXTERNO' });
    const antes = await contexto.prisma.senha.count();
    const requestId = unico();
    const r = Encaminhamento.parse(
      (
        await registrar(c.atendimento.id, {
          tipo: 'EXTERNO',
          instituicaoDestino: ' Serviço fictício ',
          motivo: ' Encaminhamento clínico ',
          observacoes: 'Observação externa',
        })
          .set('X-Request-Id', requestId)
          .set('User-Agent', 'teste-ficticio-GH26')
          .expect(201)
      ).body,
    );
    expect(r).toMatchObject({
      senhaGerada: null,
      instituicaoDestino: 'Serviço fictício',
      motivo: 'Encaminhamento clínico',
    });
    expect(await contexto.prisma.senha.count()).toBe(antes);
    expect(await contexto.prisma.encaminhamento.findUnique({ where: { id: r.id } })).toMatchObject({
      criadoPor: autor.usuarioId,
      observacoes: 'Observação externa',
    });
    const auditoria = await contexto.prisma.auditLog.findMany({
      where: { entidade: 'encaminhamento', entidadeId: r.id },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      operacao: 'CRIAR',
      usuarioId: autor.usuarioId,
      modulo: 'encaminhamento',
      requestId,
      userAgent: 'teste-ficticio-GH26',
    });
  });

  it('UC-15 instituição e motivo vazios retornam 422; RN-03 urgência exige motivo', async () => {
    const c = await origem({ desfecho: 'ENCAMINHAMENTO_EXTERNO' });
    for (const campo of ['instituicaoDestino', 'motivo']) {
      const r = await registrar(c.atendimento.id, {
        tipo: 'EXTERNO',
        instituicaoDestino: 'Serviço',
        motivo: 'Motivo',
        [campo]: '  ',
      }).expect(422);
      expect(corpo<Problema>(r).codigo).toBe('VALIDACAO');
    }
    const interno = await origem();
    const destino = await especialidade();
    await registrar(interno.atendimento.id, {
      tipo: 'INTERNO',
      especialidadeDestinoId: destino.id,
      prioridadeSugerida: 'URGENTE',
    }).expect(422);
  });

  it('RN-10 destino bloqueado permite emitir e retorna aviso', async () => {
    const c = await origem();
    const destino = await especialidade({ bloqueada: true });
    const r = Encaminhamento.parse(
      (
        await registrar(c.atendimento.id, {
          tipo: 'INTERNO',
          especialidadeDestinoId: destino.id,
        }).expect(201)
      ).body,
    );
    expect(r.senhaGerada?.status).toBe('AGUARDANDO');
    expect(r.avisos[0]?.codigo).toBe('FILA_BLOQUEADA');
  });

  it('RN-02 preserva a prioridade legal; herda prioridade atual quando não há sugestão', async () => {
    const c = await origem({ prioridade: 'PREFERENCIAL', legal: true });
    const destino = await especialidade();
    const r = Encaminhamento.parse(
      (
        await registrar(c.atendimento.id, {
          tipo: 'INTERNO',
          especialidadeDestinoId: destino.id,
          prioridadeSugerida: 'NORMAL',
        }).expect(201)
      ).body,
    );
    expect(r.senhaGerada?.prioridade).toBe('PREFERENCIAL');
    const urgente = await origem({ prioridade: 'URGENTE' });
    const herdada = Encaminhamento.parse(
      (
        await registrar(urgente.atendimento.id, {
          tipo: 'INTERNO',
          especialidadeDestinoId: destino.id,
        }).expect(201)
      ).body,
    );
    expect(herdada.senhaGerada?.prioridade).toBe('URGENTE');
  });

  it('UC-14 repetições simultâneas geram uma senha e um encaminhamento; a outra recebe DUPLICIDADE', async () => {
    const c = await origem();
    const destino = await especialidade();
    const entrada = { tipo: 'INTERNO', especialidadeDestinoId: destino.id };
    const resultados = await Promise.all([
      registrar(c.atendimento.id, entrada),
      registrar(c.atendimento.id, entrada),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(corpo<Problema>(resultados.find((r) => r.status === 409)!).codigo).toBe('DUPLICIDADE');
    expect(
      await contexto.prisma.encaminhamento.count({ where: { atendimentoId: c.atendimento.id } }),
    ).toBe(1);
    expect(await contexto.prisma.senha.count({ where: { senhaOrigemId: c.senha.id } })).toBe(1);
    await expect(
      contexto.prisma.encaminhamento.create({
        data: {
          atendimentoId: c.atendimento.id,
          tipo: 'EXTERNO',
          instituicaoDestino: 'Serviço fictício',
          motivo: 'Duplicação fictícia',
          criadoPor: autor.usuarioId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('RN-04 emissão compartilhada numera encaminhamentos simultâneos de origens distintas na mesma fila', async () => {
    const [a, b] = await Promise.all([origem(), origem()]);
    const destino = await especialidade();
    const r = await Promise.all(
      [a, b].map((c) =>
        registrar(c.atendimento.id, { tipo: 'INTERNO', especialidadeDestinoId: destino.id }).expect(
          201,
        ),
      ),
    );
    expect(
      r.map((resposta) => Encaminhamento.parse(resposta.body).senhaGerada!.numero).sort(),
    ).toEqual(['D001', 'D002']);
  });

  it('RN-11 PENDENTE_VALIDACAO recusa encaminhamento; após validação permite registrar', async () => {
    const c = await origem({ validacao: true });
    const destino = await especialidade();
    const entrada = { tipo: 'INTERNO', especialidadeDestinoId: destino.id };
    expect(c.atendimento.status).toBe('PENDENTE_VALIDACAO');
    expect(corpo<Problema>(await registrar(c.atendimento.id, entrada).expect(409)).codigo).toBe(
      'TRANSICAO_INVALIDA',
    );
    await como(api().post(`/api/v1/atendimentos/${c.atendimento.id}/validacao`))
      .send({ aprovado: true, versao: c.atendimento.versao })
      .expect(200);
    await registrar(c.atendimento.id, entrada).expect(201);
  });

  it('RNF-05 falha de auditoria desfaz encaminhamento, senha e contador, sem evento', async () => {
    const c = await origem();
    const destino = await especialidade();
    vi.spyOn(contexto.app.get(AuditoriaService), 'registrar').mockRejectedValueOnce(
      new Error('Falha fictícia de auditoria'),
    );
    const evento = vi.spyOn(contexto.app.get(EventosDominio), 'emitir');
    await registrar(c.atendimento.id, {
      tipo: 'INTERNO',
      especialidadeDestinoId: destino.id,
    }).expect(500);
    expect(
      await contexto.prisma.encaminhamento.count({ where: { atendimentoId: c.atendimento.id } }),
    ).toBe(0);
    expect(await contexto.prisma.senha.count({ where: { senhaOrigemId: c.senha.id } })).toBe(0);
    expect(
      await contexto.prisma.contadorSenha.count({ where: { filaId: destino.filas[0]!.id } }),
    ).toBe(0);
    expect(evento).not.toHaveBeenCalled();
  });

  it('RNF-01 exige criação e isola unidade da origem e do destino', async () => {
    const c = await origem();
    const destino = await especialidade();
    const entrada = { tipo: 'INTERNO', especialidadeDestinoId: destino.id };
    const rota = (id: string) => `/api/v1/atendimentos/${id}/encaminhamentos`;
    await api().post(rota(c.atendimento.id)).send(entrada).expect(401);
    const consulta = await entrarComPermissoes(contexto, ['encaminhamento:consultar']);
    for (const id of [c.atendimento.id, unico()])
      await api().post(rota(id)).auth(consulta.token, { type: 'bearer' }).send(entrada).expect(403);
    await registrar(unico(), entrada).expect(404);
    const unidade = await contexto.prisma.unidade.create({ data: { nome: unico() } });
    const estrangeiro = await especialidade({ unidadeId: unidade.id });
    expect(
      corpo<Problema>(
        await registrar(c.atendimento.id, {
          tipo: 'INTERNO',
          especialidadeDestinoId: estrangeiro.id,
        }).expect(409),
      ).codigo,
    ).toBe('ESPECIALIDADE_INATIVA');
    const outroAutor = await entrarComPermissoes(contexto, ['encaminhamento:criar']);
    await contexto.prisma.usuario.update({
      where: { id: outroAutor.usuarioId },
      data: { unidadeId: unidade.id },
    });
    await api()
      .post(rota(c.atendimento.id))
      .auth(outroAutor.token, { type: 'bearer' })
      .send(entrada)
      .expect(404);
  });
});
