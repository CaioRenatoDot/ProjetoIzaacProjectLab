import { Injectable } from '@nestjs/common';
import {
  type Especialidade,
  type EspecialidadeEntrada,
  type ListarEspecialidadesQuery,
  type RespostaPaginada,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PrismaService } from '../prisma/prisma.service';
import { duplicado, naoEncontrado, recursosInexistentes, vinculoAtivo } from './erros';
import { exigirConfirmacao, usoPorSenhas } from './impacto';

const DETALHE = {
  recursosExigidos: { select: { recurso: { select: { id: true, nome: true } } } },
  parametros: { where: { chave: 'TOLERANCIA_MINUTOS' }, select: { valor: true } },
  _count: { select: { filas: true } },
} satisfies Prisma.EspecialidadeInclude;

type EspecialidadeComDetalhe = Prisma.EspecialidadeGetPayload<{ include: typeof DETALHE }>;

function paraEspecialidade(especialidade: EspecialidadeComDetalhe): Especialidade {
  return {
    id: especialidade.id,
    nome: especialidade.nome,
    descricao: especialidade.descricao ?? '',
    exigeSupervisaoDocente: especialidade.exigeSupervisaoDocente,
    exigeValidacaoEncerramento: especialidade.exigeValidacaoEncerramento,
    toleranciaMinutos: especialidade.parametros[0]?.valor ?? null,
    recursosExigidos: especialidade.recursosExigidos.map(({ recurso }) => recurso),
    filasVinculadas: especialidade._count.filas,
    ativa: especialidade.ativo,
  };
}

/**
 * Especialidade ou serviço (Tabela 5). Duplicidade por nome sem diferenciar maiúsculas
 * (Tabela A). A tolerância própria é o parâmetro `tolerancia_minutos` da especialidade em
 * `parametro_unidade`, que sobrepõe o valor geral da unidade (docs/03 §3.1).
 */
@Injectable()
export class EspecialidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarEspecialidadesQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<Especialidade>> {
    const where: Prisma.EspecialidadeWhereInput = {
      unidadeId,
      ...(query.busca ? { nome: { contains: query.busca, mode: 'insensitive' } } : {}),
      ...(query.ativa !== undefined ? { ativo: query.ativa } : {}),
      ...(query.exigeSupervisao !== undefined
        ? { exigeSupervisaoDocente: query.exigeSupervisao }
        : {}),
      ...(query.comFila === true ? { filas: { some: { ativa: true } } } : {}),
      ...(query.comFila === false ? { filas: { none: { ativa: true } } } : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.especialidade.findMany({
        where,
        include: DETALHE,
        orderBy: { nome: query.direcao },
        ...deslocamento(query),
      }),
      this.prisma.especialidade.count({ where }),
    ]);
    return montarRespostaPaginada(dados.map(paraEspecialidade), total, query);
  }

  async consultar(id: string, unidadeId: string): Promise<Especialidade> {
    return paraEspecialidade(await this.buscar(id, unidadeId));
  }

  async criar(entrada: EspecialidadeEntrada, unidadeId: string): Promise<Especialidade> {
    await this.garantirNomeLivre(entrada.nome);
    await this.garantirRecursos(entrada.recursosExigidosIds);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const criada = await tx.especialidade.create({
          data: {
            nome: entrada.nome,
            descricao: entrada.descricao ?? null,
            exigeSupervisaoDocente: entrada.exigeSupervisaoDocente,
            exigeValidacaoEncerramento: entrada.exigeValidacaoEncerramento,
            unidadeId,
            recursosExigidos: {
              create: entrada.recursosExigidosIds.map((recursoId) => ({ recursoId })),
            },
          },
        });
        await this.gravarTolerancia(tx, criada.id, unidadeId, entrada.toleranciaMinutos);
        return criada.id;
      });
      return this.consultar(id, unidadeId);
    } catch (erro) {
      throw await this.duplicidadeConcorrente(erro, entrada.nome);
    }
  }

  async atualizar(
    id: string,
    entrada: EspecialidadeEntrada,
    unidadeId: string,
    confirmar = false,
  ): Promise<Especialidade> {
    const atual = await this.buscar(id, unidadeId);
    // exigeValidacaoEncerramento não entra: é copiado no início do atendimento (RN-11).
    if (atual.exigeSupervisaoDocente !== entrada.exigeSupervisaoDocente) {
      exigirConfirmacao(confirmar, await usoPorSenhas(this.prisma, id), ['exigeSupervisaoDocente']);
    }
    await this.garantirNomeLivre(entrada.nome, id);
    await this.garantirRecursos(entrada.recursosExigidosIds);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.especialidadeProcedimentoRequisito.deleteMany({ where: { especialidadeId: id } });
        await tx.especialidade.update({
          where: { id },
          data: {
            nome: entrada.nome,
            descricao: entrada.descricao ?? null,
            exigeSupervisaoDocente: entrada.exigeSupervisaoDocente,
            exigeValidacaoEncerramento: entrada.exigeValidacaoEncerramento,
            recursosExigidos: {
              create: entrada.recursosExigidosIds.map((recursoId) => ({ recursoId })),
            },
          },
        });
        await this.gravarTolerancia(tx, id, unidadeId, entrada.toleranciaMinutos);
      });
    } catch (erro) {
      throw await this.duplicidadeConcorrente(erro, entrada.nome);
    }
    return this.consultar(id, unidadeId);
  }

  async alterarSituacao(
    id: string,
    ativa: boolean,
    unidadeId: string,
    confirmar = false,
  ): Promise<Especialidade> {
    const atual = await this.buscar(id, unidadeId);
    if (atual.ativo && !ativa) {
      exigirConfirmacao(confirmar, await usoPorSenhas(this.prisma, id), ['ativa']);
    }
    await this.prisma.especialidade.update({ where: { id }, data: { ativo: ativa } });
    return this.consultar(id, unidadeId);
  }

  /** Recusa com o vínculo no detail; os parâmetros próprios da especialidade saem junto. */
  async excluir(id: string, unidadeId: string): Promise<void> {
    await this.buscar(id, unidadeId);
    const [estudantes, supervisores, filas] = await Promise.all([
      this.prisma.estudante.count({ where: { especialidadeId: id } }),
      this.prisma.supervisorEspecialidade.count({ where: { especialidadeId: id } }),
      this.prisma.fila.count({ where: { especialidadeId: id } }),
    ]);
    const vinculos = [
      filas ? `${filas} fila(s)` : '',
      estudantes ? `${estudantes} estudante(s)` : '',
      supervisores ? `${supervisores} supervisor(es)` : '',
    ].filter(Boolean);
    if (vinculos.length) throw vinculoAtivo('A especialidade', vinculos.join(', '));

    try {
      await this.prisma.$transaction([
        this.prisma.parametroUnidade.deleteMany({ where: { especialidadeId: id } }),
        this.prisma.especialidade.delete({ where: { id } }),
      ]);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw vinculoAtivo('A especialidade', 'outros registros (fila, triagem ou atendimento)');
      }
      throw erro;
    }
  }

  private async gravarTolerancia(
    tx: Prisma.TransactionClient,
    especialidadeId: string,
    unidadeId: string,
    toleranciaMinutos: number | undefined,
  ): Promise<void> {
    const filtro = { unidadeId, especialidadeId, chave: 'TOLERANCIA_MINUTOS' as const };
    if (toleranciaMinutos === undefined) {
      await tx.parametroUnidade.deleteMany({ where: filtro });
      return;
    }
    const atualizados = await tx.parametroUnidade.updateMany({
      where: filtro,
      data: { valor: toleranciaMinutos },
    });
    if (atualizados.count === 0) {
      await tx.parametroUnidade.create({ data: { ...filtro, valor: toleranciaMinutos } });
    }
  }

  private async buscar(id: string, unidadeId: string): Promise<EspecialidadeComDetalhe> {
    const especialidade = await this.prisma.especialidade.findFirst({
      where: { id, unidadeId },
      include: DETALHE,
    });
    if (!especialidade) throw naoEncontrado('Especialidade');
    return especialidade;
  }

  private async garantirNomeLivre(nome: string, exceto?: string): Promise<void> {
    const existente = await this.prisma.especialidade.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        ...(exceto ? { NOT: { id: exceto } } : {}),
      },
      select: { id: true },
    });
    if (existente) throw duplicado('Especialidade', existente.id);
  }

  private async garantirRecursos(ids: string[]): Promise<void> {
    if (
      ids.length &&
      (await this.prisma.recurso.count({ where: { id: { in: ids } } })) !== ids.length
    ) {
      throw recursosInexistentes('recursosExigidosIds');
    }
  }

  private async duplicidadeConcorrente(erro: unknown, nome: string): Promise<unknown> {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const existente = await this.prisma.especialidade.findFirst({
        where: { nome: { equals: nome, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existente) return duplicado('Especialidade', existente.id);
    }
    return erro;
  }
}
