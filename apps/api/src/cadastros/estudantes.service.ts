import { Injectable } from '@nestjs/common';
import {
  type Estudante,
  type EstudanteEntrada,
  type ListarEstudantesQuery,
  type RespostaPaginada,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { ErroValidacao } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PrismaService } from '../prisma/prisma.service';
import {
  doBanco,
  idsInexistentes,
  normalizarNome,
  paraBanco,
  pessoaComVinculo,
  pessoaDuplicada,
  pessoaNaoEncontrada,
} from './pessoas.util';

const DETALHE = {
  especialidade: { select: { nome: true } },
  habilitacoes: { select: { habilitacao: { select: { id: true, nome: true } } } },
  procedimentos: { select: { procedimento: { select: { id: true, nome: true } } } },
  disponibilidades: { select: { diaSemana: true, turno: true } },
  _count: { select: { alocacoes: { where: { liberadaEm: null } } } },
} satisfies Prisma.EstudanteInclude;

/** Ativo e sem alocação vigente (RN-05; o turno é conferido na alocação). */
const LIVRE = {
  ativo: true,
  alocacoes: { none: { liberadaEm: null } },
} satisfies Prisma.EstudanteWhereInput;

type EstudanteComDetalhe = Prisma.EstudanteGetPayload<{ include: typeof DETALHE }>;

function paraEstudante(estudante: EstudanteComDetalhe): Estudante {
  return {
    id: estudante.id,
    nome: estudante.nome,
    especialidadeId: estudante.especialidadeId,
    especialidade: estudante.especialidade.nome,
    nivelFormacao: estudante.nivelFormacao,
    habilitacoes: estudante.habilitacoes.map(({ habilitacao }) => habilitacao),
    procedimentosAutorizados: estudante.procedimentos.map(({ procedimento }) => procedimento),
    disponibilidade: estudante.disponibilidades.map(doBanco),
    ocupado: estudante._count.alocacoes > 0,
    ativo: estudante.ativo,
  };
}

/**
 * Estudante ou atendente (Tabela 2, RN-05, RN-06). Duplicidade por nome + especialidade, sem
 * diferenciar maiúsculas (decidido na #81). A unidade vem da especialidade (RNF-08).
 */
@Injectable()
export class EstudantesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarEstudantesQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<Estudante>> {
    const where: Prisma.EstudanteWhereInput = {
      especialidade: { unidadeId },
      ...(query.busca ? { nome: { contains: query.busca, mode: 'insensitive' } } : {}),
      ...(query.especialidadeId ? { especialidadeId: query.especialidadeId } : {}),
      ...(query.nivelFormacao
        ? { nivelFormacao: { equals: query.nivelFormacao, mode: 'insensitive' } }
        : {}),
      ...(query.turno ? { disponibilidades: { some: { turno: query.turno } } } : {}),
      ...(query.disponivel === true ? LIVRE : {}),
      ...(query.disponivel === false ? { NOT: LIVRE } : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.estudante.findMany({
        where,
        include: DETALHE,
        orderBy: { nome: query.direcao },
        ...deslocamento(query),
      }),
      this.prisma.estudante.count({ where }),
    ]);
    return montarRespostaPaginada(dados.map(paraEstudante), total, query);
  }

  async consultar(id: string, unidadeId: string): Promise<Estudante> {
    return paraEstudante(await this.buscar(id, unidadeId));
  }

  async criar(entrada: EstudanteEntrada, unidadeId: string): Promise<Estudante> {
    const nome = normalizarNome(entrada.nome);
    await this.validarReferencias(entrada, unidadeId);
    await this.garantirSemDuplicidade(nome, entrada.especialidadeId);
    const estudante = await this.prisma.estudante.create({
      data: {
        nome,
        especialidadeId: entrada.especialidadeId,
        nivelFormacao: entrada.nivelFormacao,
        ...this.vinculos(entrada),
      },
      include: DETALHE,
    });
    return paraEstudante(estudante);
  }

  async atualizar(id: string, entrada: EstudanteEntrada, unidadeId: string): Promise<Estudante> {
    await this.buscar(id, unidadeId);
    const nome = normalizarNome(entrada.nome);
    await this.validarReferencias(entrada, unidadeId);
    await this.garantirSemDuplicidade(nome, entrada.especialidadeId, id);
    const estudante = await this.prisma.$transaction(async (tx) => {
      await tx.estudanteHabilitacao.deleteMany({ where: { estudanteId: id } });
      await tx.estudanteProcedimento.deleteMany({ where: { estudanteId: id } });
      await tx.estudanteDisponibilidade.deleteMany({ where: { estudanteId: id } });
      return tx.estudante.update({
        where: { id },
        data: {
          nome,
          especialidadeId: entrada.especialidadeId,
          nivelFormacao: entrada.nivelFormacao,
          ...this.vinculos(entrada),
        },
        include: DETALHE,
      });
    });
    return paraEstudante(estudante);
  }

  async alterarSituacao(id: string, ativo: boolean, unidadeId: string): Promise<Estudante> {
    await this.buscar(id, unidadeId);
    return paraEstudante(
      await this.prisma.estudante.update({ where: { id }, data: { ativo }, include: DETALHE }),
    );
  }

  async excluir(id: string, unidadeId: string): Promise<void> {
    await this.buscar(id, unidadeId);
    try {
      await this.prisma.estudante.delete({ where: { id } });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw pessoaComVinculo('Estudante');
      }
      throw erro;
    }
  }

  private vinculos(entrada: EstudanteEntrada) {
    return {
      habilitacoes: { create: entrada.habilitacoesIds.map((habilitacaoId) => ({ habilitacaoId })) },
      procedimentos: {
        create: entrada.procedimentosIds.map((procedimentoId) => ({ procedimentoId })),
      },
      disponibilidades: { create: entrada.disponibilidade.map(paraBanco) },
    };
  }

  private async buscar(id: string, unidadeId: string): Promise<EstudanteComDetalhe> {
    const estudante = await this.prisma.estudante.findFirst({
      where: { id, especialidade: { unidadeId } },
      include: DETALHE,
    });
    if (!estudante) throw pessoaNaoEncontrada('Estudante');
    return estudante;
  }

  private async validarReferencias(entrada: EstudanteEntrada, unidadeId: string): Promise<void> {
    const [especialidade, habilitacoes, procedimentos] = await Promise.all([
      this.prisma.especialidade.count({ where: { id: entrada.especialidadeId, unidadeId } }),
      this.prisma.habilitacao.count({ where: { id: { in: entrada.habilitacoesIds } } }),
      this.prisma.procedimento.count({ where: { id: { in: entrada.procedimentosIds } } }),
    ]);
    if (!especialidade) {
      throw new ErroValidacao([
        { campo: 'especialidadeId', mensagem: 'Selecione uma especialidade existente.' },
      ]);
    }
    if (habilitacoes !== entrada.habilitacoesIds.length) {
      throw idsInexistentes('habilitacoesIds', 'habilitações');
    }
    if (procedimentos !== entrada.procedimentosIds.length) {
      throw idsInexistentes('procedimentosIds', 'procedimentos');
    }
  }

  private async garantirSemDuplicidade(
    nome: string,
    especialidadeId: string,
    exceto?: string,
  ): Promise<void> {
    const existente = await this.prisma.estudante.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        especialidadeId,
        ...(exceto ? { NOT: { id: exceto } } : {}),
      },
      select: { id: true },
    });
    if (existente) {
      throw pessoaDuplicada('Estudante', existente.id, 'esse nome nesta especialidade');
    }
  }
}
