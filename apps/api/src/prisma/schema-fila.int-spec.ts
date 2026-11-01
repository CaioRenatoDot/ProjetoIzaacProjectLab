import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { garantirBancoDeTeste } from '../common/testing/banco-de-teste';

const prisma = new PrismaClient({
  datasourceUrl: garantirBancoDeTeste(process.env.DATABASE_URL_TEST),
});

const UNIDADE = '01900000-0000-7000-8000-000000000001';
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;

const codigoDoErro = async (operacao: Promise<unknown>): Promise<string | undefined> => {
  try {
    await operacao;
    return undefined;
  } catch (erro) {
    return erro instanceof Prisma.PrismaClientKnownRequestError ? erro.code : 'outro';
  }
};

describe('schema de fila, senha, alocação e atendimento (parte 2.2)', () => {
  let usuarioId: string;
  let pacienteId: string;
  let especialidadeId: string;
  let filaId: string;
  let triagemId: string;

  const novaSenha = (dados: Partial<Prisma.SenhaUncheckedCreateInput> = {}) =>
    prisma.senha.create({
      data: {
        numero: `F${String(++seq).padStart(3, '0')}`,
        filaId,
        triagemId,
        pacienteId,
        prioridade: 'NORMAL',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        ...dados,
      },
    });

  const novaAlocacao = async (senhaId: string) =>
    prisma.alocacao.create({
      data: {
        senhaId,
        estudanteId: (
          await prisma.estudante.create({
            data: { nome: unico('Estudante'), especialidadeId, nivelFormacao: '7º período' },
          })
        ).id,
        salaId: (
          await prisma.sala.create({ data: { identificacao: unico('Sala'), unidadeId: UNIDADE } })
        ).id,
        confirmadaPor: usuarioId,
      },
    });

  beforeAll(async () => {
    const perfil = await prisma.perfil.create({ data: { nome: unico('Perfil 2.2') } });
    usuarioId = (
      await prisma.usuario.create({
        data: {
          nome: 'Atendente Ficticio',
          identificacao: `${unico('atendente').replace(/\W/g, '')}@clinica.invalid`,
          senhaHash: 'hash-ficticio',
          perfilId: perfil.id,
          unidadeId: UNIDADE,
        },
      })
    ).id;
    pacienteId = (
      await prisma.paciente.create({
        data: {
          nomeCompleto: unico('Paciente Ficticio'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1980-05-05'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE,
        },
      })
    ).id;
    especialidadeId = (
      await prisma.especialidade.create({
        data: { nome: unico('Fisioterapia'), unidadeId: UNIDADE },
      })
    ).id;
    filaId = (
      await prisma.fila.create({
        data: { especialidadeId, unidadeId: UNIDADE, nome: 'Fisioterapia', letraSenha: 'F' },
      })
    ).id;
    triagemId = (
      await prisma.triagem.create({
        data: {
          pacienteId,
          profissionalId: usuarioId,
          especialidadeDestinoId: especialidadeId,
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
          prioridade: 'PREFERENCIAL',
          motivo: 'Motivo ficticio',
          enquadramentoLegal: 'IDOSO',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('a senha nasce AGUARDANDO, na versão 1 e sem agendamento prévio', async () => {
    const senha = await novaSenha();

    expect(senha).toMatchObject({ status: 'AGUARDANDO', versao: 1, temAgendamentoPrevio: false });
  });

  it('RF-07 recusa um segundo atendimento para a mesma senha', async () => {
    const senha = await novaSenha();
    const alocacao = await novaAlocacao(senha.id);
    const atendimento = { senhaId: senha.id, alocacaoId: alocacao.id, validacaoExigida: false };
    await prisma.atendimento.create({ data: atendimento });

    expect(await codigoDoErro(prisma.atendimento.create({ data: atendimento }))).toBe('P2002');
  });

  it('RN-04 o índice de ordenação usa prioridade e agendamento em ordem decrescente', async () => {
    const [indice] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_senha_ordem'`;

    expect(indice?.indexdef).toContain(
      '(fila_id, status, prioridade DESC, chegada_em, tem_agendamento_previo DESC)',
    );
  });

  it('RF-08 liga a senha gerada por encaminhamento interno à senha de origem', async () => {
    const origem = await novaSenha();
    const gerada = await novaSenha({ senhaOrigemId: origem.id });

    const derivadas = await prisma.senha.findUniqueOrThrow({
      where: { id: origem.id },
      select: { senhasDerivadas: { select: { id: true } } },
    });

    expect(derivadas.senhasDerivadas).toEqual([{ id: gerada.id }]);
  });

  it('não repete a sequência de chamada da mesma senha', async () => {
    const senha = await novaSenha();
    const chamada = { senhaId: senha.id, usuarioId, localExibicao: 'Sala 3', sequencia: 1 };
    await prisma.chamada.create({ data: chamada });

    expect(await codigoDoErro(prisma.chamada.create({ data: chamada }))).toBe('P2002');
  });

  it('registra uma desistência por senha', async () => {
    const senha = await novaSenha();
    const desistencia = {
      senhaId: senha.id,
      origem: 'PACIENTE' as const,
      registradoPor: usuarioId,
    };
    await prisma.desistencia.create({ data: desistencia });

    expect(await codigoDoErro(prisma.desistencia.create({ data: desistencia }))).toBe('P2002');
  });

  it('não exclui senha com histórico (FK Restrict)', async () => {
    const senha = await novaSenha();
    await prisma.ausencia.create({ data: { senhaId: senha.id, automatica: true } });

    expect(await codigoDoErro(prisma.senha.delete({ where: { id: senha.id } }))).toBe('P2003');
  });

  it('guarda alerta com escalonamento e chave de idempotência', async () => {
    const alerta = await prisma.alerta.create({
      data: {
        tipo: 'SLA_EXCEDIDO',
        filaId,
        unidadeId: UNIDADE,
        escalonamentos: { create: { acao: 'VAGA_EXTRA', acionadoPor: usuarioId } },
      },
      include: { escalonamentos: true },
    });
    const chave = {
      usuarioId,
      chave: randomUUID(),
      operacao: `POST /filas/${filaId}/chamadas`,
      statusHttp: 201,
      resposta: { ok: true },
    };
    await prisma.chaveIdempotencia.create({ data: chave });

    expect(alerta).toMatchObject({ status: 'ATIVO', escalonamentos: [{ acao: 'VAGA_EXTRA' }] });
    expect(await codigoDoErro(prisma.chaveIdempotencia.create({ data: chave }))).toBe('P2002');
  });
});
