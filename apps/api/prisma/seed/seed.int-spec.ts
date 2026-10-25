import { PERMISSOES } from '@filas/contracts';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { senhaConfere } from '../../src/auth/senha';
import { garantirBancoDeTeste } from '../../src/common/testing/banco-de-teste';
import { ESPECIALIDADES, FILAS, PACIENTES, PERFIS, USUARIOS } from './dados';
import { executarSeed } from './executar';

const prisma = new PrismaClient({
  datasourceUrl: garantirBancoDeTeste(process.env.DATABASE_URL_TEST),
});
const ADMIN = PERFIS[0]!.id;
const SENHA = 'senha-de-teste-do-seed';

const contagens = async () => ({
  perfis: await prisma.perfil.count({ where: { id: { in: PERFIS.map((p) => p.id) } } }),
  usuarios: await prisma.usuario.count({ where: { id: { in: USUARIOS.map((u) => u.id) } } }),
  pacientes: await prisma.paciente.count({ where: { id: { in: PACIENTES.map((p) => p.id) } } }),
  filas: await prisma.fila.count({ where: { id: { in: FILAS.map((f) => f.id) } } }),
});

describe('seed de dados fictícios (parte 2.4)', () => {
  beforeAll(async () => {
    await executarSeed(prisma, SENHA);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cria os perfis, os usuários e os pacientes fictícios', async () => {
    // Num banco com registros anteriores de mesmo nome ou documento, o seed os reaproveita.
    const { perfis, usuarios, pacientes } = await contagens();
    expect(perfis).toBeGreaterThan(0);
    expect(usuarios).toBeGreaterThan(0);
    expect(pacientes).toBeGreaterThanOrEqual(PACIENTES.length - 1);
  });

  it('é idempotente: rodar de novo não duplica nada', async () => {
    const antes = await contagens();

    await executarSeed(prisma, SENHA);

    expect(await contagens()).toEqual(antes);
  });

  it('RF-04 cada especialidade do seed tem exatamente uma fila ativa, com a letra própria', async () => {
    const especialidades = await prisma.especialidade.findMany({
      where: { nome: { in: ESPECIALIDADES.map((e) => e.nome) } },
      select: { nome: true, filas: { where: { ativa: true }, select: { letraSenha: true } } },
    });

    expect(especialidades).toHaveLength(ESPECIALIDADES.length);
    for (const especialidade of especialidades) {
      expect(especialidade.filas).toHaveLength(1);
    }
    expect(Object.fromEntries(especialidades.map((e) => [e.nome, e.filas[0]?.letraSenha]))).toEqual(
      Object.fromEntries(ESPECIALIDADES.map((e) => [e.nome, e.letraSenha])),
    );
  });

  it('o administrador tem todo o catálogo e recebe permissão que estiver faltando', async () => {
    await prisma.perfilPermissao.delete({
      where: { perfilId_permissao: { perfilId: ADMIN, permissao: 'fila:chamar' } },
    });

    await executarSeed(prisma, SENHA);

    const permissoes = await prisma.perfilPermissao.findMany({ where: { perfilId: ADMIN } });
    expect(permissoes.map((p) => p.permissao).sort()).toEqual([...PERMISSOES].sort());
  });

  it('não sobrescreve o que foi editado depois (perfil comum e senha)', async () => {
    const recepcao = PERFIS[1]!.id;
    await prisma.perfil.update({ where: { id: recepcao }, data: { descricao: 'Editado na tela' } });
    await prisma.usuario.update({
      where: { id: USUARIOS[0]!.id },
      data: { senhaHash: 'hash-trocado-pela-tela' },
    });

    await executarSeed(prisma, SENHA);

    expect((await prisma.perfil.findUniqueOrThrow({ where: { id: recepcao } })).descricao).toBe(
      'Editado na tela',
    );
    expect(
      (await prisma.usuario.findUniqueOrThrow({ where: { id: USUARIOS[0]!.id } })).senhaHash,
    ).toBe('hash-trocado-pela-tela');
  });

  it('senha dos usuários com o mesmo hash do login (argon2id)', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: USUARIOS[1]!.id } });

    expect(await senhaConfere(usuario.senhaHash, SENHA)).toBe(true);
  });

  it('RNF-07 nenhum contato de domínio real', () => {
    expect(USUARIOS.every((u) => u.identificacao.endsWith('@clinica.invalid'))).toBe(true);
    expect(PACIENTES.every((p) => p.contatoEmail.endsWith('@clinica.invalid'))).toBe(true);
    expect(PACIENTES.every((p) => p.contatoTelefone === '(00) 0000-0000')).toBe(true);
  });
});
