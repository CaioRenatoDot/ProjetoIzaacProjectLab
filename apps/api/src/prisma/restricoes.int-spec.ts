import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

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
    return String((erro as Error).message);
  }
};

describe('restrições do banco e parâmetros da unidade (parte 2.3)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('RNF-05: audit_log append-only para o usuário da aplicação', () => {
    it('RNF-05 permite inserir e consultar a trilha', async () => {
      const { id } = await prisma.auditLog.create({
        data: { operacao: 'CRIAR', modulo: 'teste', entidade: 'teste' },
      });

      expect(await prisma.auditLog.findUnique({ where: { id } })).not.toBeNull();
    });

    it.each([
      ['UPDATE', `UPDATE audit_log SET modulo = 'alterado'`],
      ['DELETE', 'DELETE FROM audit_log'],
      ['TRUNCATE', 'TRUNCATE audit_log'],
    ])('RNF-05 nega %s no audit_log', async (_operacao, sql) => {
      expect(await erroDe(prisma.$executeRawUnsafe(sql))).toMatch(/permission denied/);
    });

    it('nega escrita no histórico de migrações', async () => {
      expect(await erroDe(prisma.$executeRawUnsafe(`DELETE FROM _prisma_migrations`))).toMatch(
        /permission denied/,
      );
    });
  });

  describe('parâmetros da unidade (Tabela 8)', () => {
    it('o banco recém-migrado tem os seis parâmetros provisórios', async () => {
      const parametros = await prisma.parametroUnidade.findMany({
        where: { unidadeId: UNIDADE, especialidadeId: null },
        select: { chave: true, valor: true },
      });

      expect(Object.fromEntries(parametros.map((p) => [p.chave, p.valor]))).toEqual({
        TOLERANCIA_MINUTOS: 5,
        SLA_MINUTOS: 25,
        REINCIDENCIAS_RESTRICAO: 3,
        JANELA_REINCIDENCIA_DIAS: 90,
        LIMITE_ESTUDANTES_SUPERVISOR: 3,
        JUSTIFICATIVA_MIN_CARACTERES: 20,
      });
    });

    it('recusa um segundo valor geral para a mesma chave (especialidade nula)', async () => {
      expect(
        await erroDe(
          prisma.parametroUnidade.create({
            data: { unidadeId: UNIDADE, chave: 'SLA_MINUTOS', valor: 30 },
          }),
        ),
      ).toMatch(/Unique constraint/);
    });

    it('aceita um valor por especialidade, que sobrepõe o geral', async () => {
      const especialidade = await prisma.especialidade.create({
        data: { nome: unico('Especialidade com SLA proprio'), unidadeId: UNIDADE },
      });

      await expect(
        prisma.parametroUnidade.create({
          data: {
            unidadeId: UNIDADE,
            especialidadeId: especialidade.id,
            chave: 'SLA_MINUTOS',
            valor: 40,
          },
        }),
      ).resolves.toBeTruthy();
    });

    it('recusa valor zero', async () => {
      expect(
        await erroDe(
          prisma.$executeRawUnsafe(
            `UPDATE parametro_unidade SET valor = 0 WHERE chave = 'sla_minutos'`,
          ),
        ),
      ).toMatch(/parametro_unidade_valor_check/);
    });
  });

  describe('restrições das tabelas de acesso e cadastro', () => {
    it('recusa permissão fora do formato modulo:operacao', async () => {
      const perfil = await prisma.perfil.create({ data: { nome: unico('Perfil formato') } });

      expect(
        await erroDe(
          prisma.perfilPermissao.create({
            data: { perfilId: perfil.id, permissao: 'Fila Chamar' },
          }),
        ),
      ).toMatch(/perfil_permissao_formato_check/);
    });

    it('RN-08 recusa limite de estudantes por supervisor igual a zero', async () => {
      expect(
        await erroDe(
          prisma.supervisor.create({
            data: { nome: 'Supervisor', limiteEstudantesSimultaneos: 0 },
          }),
        ),
      ).toMatch(/supervisor_limite_estudantes_check/);
    });
  });
});
