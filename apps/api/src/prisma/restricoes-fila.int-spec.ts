import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { garantirBancoDeTeste } from '../common/testing/banco-de-teste';

/** Conecta como o usuário da aplicação (filas_app), o mesmo da API. */
const prisma = new PrismaClient({
  datasourceUrl: garantirBancoDeTeste(process.env.DATABASE_URL_TEST),
});

const UNIDADE = '01900000-0000-7000-8000-000000000001';
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;

const erroDe = async (operacao: Promise<unknown>): Promise<string> => {
  try {
    await operacao;
    return 'sem erro';
  } catch (erro) {
    return erro instanceof Prisma.PrismaClientKnownRequestError
      ? `${erro.code} ${erro.message}`
      : String((erro as Error).message);
  }
};

describe('restrições de triagem, fila, senha e alocação (parte 2.3)', () => {
  let usuarioId: string;
  let pacienteId: string;
  let especialidadeId: string;
  let filaId: string;
  let triagemId: string;

  const novaTriagem = (dados: Partial<Prisma.TriagemUncheckedCreateInput> = {}) =>
    prisma.triagem.create({
      data: {
        pacienteId,
        profissionalId: usuarioId,
        especialidadeDestinoId: especialidadeId,
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        prioridade: 'NORMAL',
        motivo: 'Motivo ficticio',
        ...dados,
      },
    });

  const novaSenha = async () =>
    (
      await prisma.senha.create({
        data: {
          numero: `F${String(++seq % 1000).padStart(3, '0')}`,
          filaId,
          triagemId,
          pacienteId,
          prioridade: 'NORMAL',
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
        },
      })
    ).id;

  const novoEstudante = async () =>
    (
      await prisma.estudante.create({
        data: { nome: unico('Estudante'), especialidadeId, nivelFormacao: '7º período' },
      })
    ).id;

  const novaSala = async () =>
    (await prisma.sala.create({ data: { identificacao: unico('Sala'), unidadeId: UNIDADE } })).id;

  const alocar = async (estudanteId: string, salaId: string) =>
    prisma.alocacao.create({
      data: { senhaId: await novaSenha(), estudanteId, salaId, confirmadaPor: usuarioId },
    });

  beforeAll(async () => {
    const perfil = await prisma.perfil.create({ data: { nome: unico('Perfil 2.3') } });
    usuarioId = (
      await prisma.usuario.create({
        data: {
          nome: 'Triagem Ficticia',
          identificacao: `${unico('triagem').replace(/\W/g, '')}@clinica.invalid`,
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
          dataNascimento: new Date('1975-03-03'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE,
        },
      })
    ).id;
    especialidadeId = (
      await prisma.especialidade.create({ data: { nome: unico('Nutricao'), unidadeId: UNIDADE } })
    ).id;
    filaId = (
      await prisma.fila.create({
        data: { especialidadeId, unidadeId: UNIDADE, nome: 'Nutricao', letraSenha: 'N' },
      })
    ).id;
    triagemId = (await novaTriagem()).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('RN-01: justificativa da reclassificação', () => {
    const reclassificar = async (justificativa: string) =>
      prisma.reclassificacaoPrioridade.create({
        data: {
          senhaId: await novaSenha(),
          dePrioridade: 'NORMAL',
          paraPrioridade: 'URGENTE',
          justificativa,
          usuarioId,
        },
      });

    it('RN-01 recusa justificativa vazia ou só com espaços', async () => {
      expect(await erroDe(reclassificar('   '))).toMatch(/reclassificacao_justificativa_check/);
    });

    it('RN-01 aceita justificativa curta: o tamanho mínimo é do service', async () => {
      expect(await erroDe(reclassificar('curta'))).toBe('sem erro');
    });
  });

  describe('RN-03: justificativa clínica na urgência', () => {
    it('RN-03 recusa triagem URGENTE sem justificativa clínica', async () => {
      expect(await erroDe(novaTriagem({ prioridade: 'URGENTE' }))).toMatch(
        /triagem_urgente_justificativa_check/,
      );
      expect(
        await erroDe(novaTriagem({ prioridade: 'URGENTE', justificativaClinica: '  ' })),
      ).toMatch(/triagem_urgente_justificativa_check/);
    });

    it('RN-03 aceita urgência justificada e prioridade não urgente sem justificativa', async () => {
      expect(
        await erroDe(novaTriagem({ prioridade: 'URGENTE', justificativaClinica: 'Dor intensa' })),
      ).toBe('sem erro');
      expect(await erroDe(novaTriagem({ prioridade: 'PREFERENCIAL' }))).toBe('sem erro');
    });
  });

  describe('RN-05 e RN-09: uma alocação não liberada por estudante e por sala', () => {
    it('RN-05 recusa segunda alocação ativa do mesmo estudante', async () => {
      const estudanteId = await novoEstudante();
      await alocar(estudanteId, await novaSala());

      expect(await erroDe(alocar(estudanteId, await novaSala()))).toMatch(/^P2002/);
    });

    it('RN-09 recusa segunda alocação ativa da mesma sala', async () => {
      const salaId = await novaSala();
      await alocar(await novoEstudante(), salaId);

      expect(await erroDe(alocar(await novoEstudante(), salaId))).toMatch(/^P2002/);
    });

    it('RN-05 RN-09 libera estudante e sala quando a alocação é liberada', async () => {
      const estudanteId = await novoEstudante();
      const salaId = await novaSala();
      const { id } = await alocar(estudanteId, salaId);
      await prisma.alocacao.update({ where: { id }, data: { liberadaEm: new Date() } });

      expect(await erroDe(alocar(estudanteId, salaId))).toBe('sem erro');
    });

    it('RN-08 o supervisor pode ter várias alocações ativas', async () => {
      const supervisorId = (await prisma.supervisor.create({ data: { nome: unico('Prof.') } })).id;
      const comSupervisor = async () =>
        prisma.alocacao.create({
          data: {
            senhaId: await novaSenha(),
            estudanteId: await novoEstudante(),
            salaId: await novaSala(),
            supervisorId,
            confirmadaPor: usuarioId,
          },
        });
      await comSupervisor();

      expect(await erroDe(comSupervisor())).toBe('sem erro');
    });
  });

  describe('RF-04: uma fila ativa por especialidade', () => {
    it('RF-04 recusa segunda fila ativa e aceita inativa', async () => {
      const fila = { especialidadeId, unidadeId: UNIDADE, nome: 'Outra', letraSenha: 'N' };

      expect(await erroDe(prisma.fila.create({ data: fila }))).toMatch(/^P2002/);
      expect(await erroDe(prisma.fila.create({ data: { ...fila, ativa: false } }))).toBe(
        'sem erro',
      );
    });

    it('recusa letra da senha fora de A a Z', async () => {
      const outra = await prisma.especialidade.create({
        data: { nome: unico('Fono'), unidadeId: UNIDADE },
      });

      expect(
        await erroDe(
          prisma.fila.create({
            data: { especialidadeId: outra.id, unidadeId: UNIDADE, nome: 'Fono', letraSenha: 'a' },
          }),
        ),
      ).toMatch(/fila_letra_senha_check/);
    });
  });
});
