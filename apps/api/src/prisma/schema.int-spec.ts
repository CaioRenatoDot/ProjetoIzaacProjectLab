import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { garantirBancoDeTeste } from '../common/testing/banco-de-teste';

const prisma = new PrismaClient({
  datasourceUrl: garantirBancoDeTeste(process.env.DATABASE_URL_TEST),
});

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

describe('schema de acesso, cadastros base e auditoria (parte 2.1)', () => {
  let unidadeId: string;
  let perfilId: string;
  let nomePerfil: string;
  let identificacao: string;

  beforeAll(async () => {
    nomePerfil = unico('Perfil de teste');
    identificacao = `${unico('usuario').replace(/\W/g, '')}@clinica.invalid`;
    unidadeId = (await prisma.unidade.create({ data: { nome: 'Unidade de teste' } })).id;
    perfilId = (await prisma.perfil.create({ data: { nome: nomePerfil } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('gera identificadores UUID v7', async () => {
    const { id } = await prisma.recurso.create({ data: { nome: unico('Maca') } });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('recusa paciente com documento repetido', async () => {
    const paciente = {
      nomeCompleto: unico('Paciente Ficticio Um'),
      documento: `${Date.now()}${++seq}`.slice(-11),
      dataNascimento: new Date('1990-01-01'),
      vinculo: 'EXTERNO' as const,
      unidadeId,
    };
    await prisma.paciente.create({ data: paciente });

    expect(
      await codigoDoErro(
        prisma.paciente.create({ data: { ...paciente, nomeCompleto: 'Outro Nome' } }),
      ),
    ).toBe('P2002');
  });

  it('recusa perfil com nome repetido', async () => {
    expect(await codigoDoErro(prisma.perfil.create({ data: { nome: nomePerfil } }))).toBe('P2002');
  });

  it('não exclui perfil com usuário vinculado', async () => {
    await prisma.usuario.create({
      data: {
        nome: 'Usuario Ficticio',
        identificacao,
        senhaHash: 'hash-ficticio',
        perfilId,
        unidadeId,
      },
    });

    expect(await codigoDoErro(prisma.perfil.delete({ where: { id: perfilId } }))).toBe('P2003');
  });

  it('remove as permissões junto com o perfil', async () => {
    const perfil = await prisma.perfil.create({
      data: {
        nome: unico('Perfil sem usuario'),
        permissoes: { create: [{ permissao: 'fila:consultar' }] },
      },
    });

    await prisma.perfil.delete({ where: { id: perfil.id } });

    expect(await prisma.perfilPermissao.count({ where: { perfilId: perfil.id } })).toBe(0);
  });

  it('não exclui usuário referenciado pela auditoria', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { identificacao },
    });
    await prisma.auditLog.create({
      data: { usuarioId: usuario.id, operacao: 'LOGIN', modulo: 'auth', entidade: 'usuario' },
    });

    expect(await codigoDoErro(prisma.usuario.delete({ where: { id: usuario.id } }))).toBe('P2003');
  });

  it('não exclui recurso usado por sala', async () => {
    const recurso = await prisma.recurso.create({ data: { nome: unico('Cadeira odontologica') } });
    await prisma.sala.create({
      data: {
        identificacao: 'Sala 1',
        unidadeId,
        recursos: { create: [{ recursoId: recurso.id }] },
      },
    });

    expect(await codigoDoErro(prisma.recurso.delete({ where: { id: recurso.id } }))).toBe('P2003');
  });
});
