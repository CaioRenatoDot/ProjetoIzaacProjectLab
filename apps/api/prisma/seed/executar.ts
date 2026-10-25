import { PERMISSOES } from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';

import { gerarHashSenha } from '../../src/auth/senha';
import {
  ESPECIALIDADES,
  ESTUDANTES,
  HABILITACOES,
  PACIENTES,
  PERFIS,
  PROCEDIMENTOS,
  RECURSOS,
  SALAS,
  SUPERVISORES,
  UNIDADE,
  USUARIOS,
} from './dados';

/**
 * Popula o banco com dados fictícios. Idempotente e sem sobrescrever: o que já existe fica como
 * está (edições feitas pela tela sobrevivem a uma nova execução). A exceção é o perfil do sistema,
 * que recebe as permissões novas do catálogo para o administrador não ficar sem acesso às rotas
 * de etapas futuras. Os parâmetros da unidade vêm da migração da parte 2.3, não daqui.
 *
 * Registro com o mesmo nome único (perfil, especialidade, apoio) ou documento (paciente) já
 * cadastrado antes do seed é reaproveitado: as referências usam o id que está de fato no banco.
 */
export async function executarSeed(prisma: PrismaClient, senhaUsuarios: string): Promise<void> {
  const idReal = new Map<string, string>();
  const real = (ids: string[]) => ids.map((id) => idReal.get(id) ?? id);

  await prisma.unidade.upsert({
    where: { id: UNIDADE },
    create: { id: UNIDADE, nome: 'Clínica-Escola' },
    update: {},
  });

  for (const perfil of PERFIS) {
    const permissoes = perfil.permissoes === 'todas' ? [...PERMISSOES] : perfil.permissoes;
    const existente = await prisma.perfil.findFirst({
      where: { OR: [{ id: perfil.id }, { nome: perfil.nome }] },
    });
    if (!existente) {
      await prisma.perfil.create({
        data: {
          id: perfil.id,
          nome: perfil.nome,
          descricao: perfil.descricao,
          sistema: perfil.sistema,
          permissoes: { create: permissoes.map((permissao) => ({ permissao })) },
        },
      });
      continue;
    }
    idReal.set(perfil.id, existente.id);
    if (existente.sistema) {
      await prisma.perfilPermissao.createMany({
        data: permissoes.map((permissao) => ({ perfilId: existente.id, permissao })),
        skipDuplicates: true,
      });
    }
  }

  const senhaHash = await gerarHashSenha(senhaUsuarios);
  await prisma.usuario.createMany({
    data: USUARIOS.map((usuario) => ({
      ...usuario,
      perfilId: idReal.get(usuario.perfilId) ?? usuario.perfilId,
      senhaHash,
      unidadeId: UNIDADE,
    })),
    skipDuplicates: true,
  });

  for (const [tabela, itens] of [
    ['habilitacao', HABILITACOES],
    ['procedimento', PROCEDIMENTOS],
    ['recurso', RECURSOS],
  ] as const) {
    const delegate = prisma[tabela] as unknown as {
      createMany(args: {
        data: { id: string; nome: string }[];
        skipDuplicates: boolean;
      }): Promise<unknown>;
      findMany(args: {
        where: { nome: { in: string[] } };
      }): Promise<{ id: string; nome: string }[]>;
    };
    await delegate.createMany({ data: itens, skipDuplicates: true });
    const noBanco = await delegate.findMany({ where: { nome: { in: itens.map((i) => i.nome) } } });
    for (const item of itens) {
      idReal.set(item.id, noBanco.find((b) => b.nome === item.nome)!.id);
    }
  }

  for (const especialidade of ESPECIALIDADES) {
    const existente = await prisma.especialidade.findFirst({
      where: { OR: [{ id: especialidade.id }, { nome: especialidade.nome }] },
      select: { id: true },
    });
    if (existente) {
      idReal.set(especialidade.id, existente.id);
      continue;
    }
    await prisma.especialidade.create({
      data: {
        id: especialidade.id,
        nome: especialidade.nome,
        exigeSupervisaoDocente: especialidade.exigeSupervisaoDocente,
        exigeValidacaoEncerramento: especialidade.exigeValidacaoEncerramento,
        unidadeId: UNIDADE,
        recursosExigidos: {
          create: real(especialidade.recursos).map((recursoId) => ({ recursoId })),
        },
      },
    });
  }

  for (const sala of SALAS) {
    await prisma.sala.upsert({
      where: { id: sala.id },
      create: {
        id: sala.id,
        identificacao: sala.identificacao,
        caracteristicas: sala.caracteristicas,
        situacao: sala.situacao,
        unidadeId: UNIDADE,
        recursos: { create: real(sala.recursos).map((recursoId) => ({ recursoId })) },
      },
      update: {},
    });
  }

  for (const supervisor of SUPERVISORES) {
    await prisma.supervisor.upsert({
      where: { id: supervisor.id },
      create: {
        id: supervisor.id,
        nome: supervisor.nome,
        limiteEstudantesSimultaneos: supervisor.limite,
        especialidades: {
          create: real(supervisor.especialidades).map((especialidadeId) => ({ especialidadeId })),
        },
        procedimentos: {
          create: real(supervisor.procedimentos).map((procedimentoId) => ({ procedimentoId })),
        },
        disponibilidades: { create: supervisor.disponibilidade },
      },
      update: {},
    });
  }

  for (const estudante of ESTUDANTES) {
    await prisma.estudante.upsert({
      where: { id: estudante.id },
      create: {
        id: estudante.id,
        nome: estudante.nome,
        especialidadeId: idReal.get(estudante.especialidadeId) ?? estudante.especialidadeId,
        nivelFormacao: estudante.nivelFormacao,
        habilitacoes: {
          create: real(estudante.habilitacoes).map((habilitacaoId) => ({ habilitacaoId })),
        },
        procedimentos: {
          create: real(estudante.procedimentos).map((procedimentoId) => ({ procedimentoId })),
        },
        disponibilidades: { create: estudante.disponibilidade },
      },
      update: {},
    });
  }

  await prisma.paciente.createMany({
    data: PACIENTES.map((paciente) => ({
      ...paciente,
      dataNascimento: new Date(paciente.dataNascimento),
      restricaoAte: paciente.restricaoAte ? new Date(paciente.restricaoAte) : null,
      unidadeId: UNIDADE,
    })),
    skipDuplicates: true,
  });
}
