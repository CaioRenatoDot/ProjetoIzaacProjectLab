import { Injectable } from '@nestjs/common';
import {
  type ListarPacientesQuery,
  type Paciente,
  type PacienteDetalhe,
  type PacienteEntrada,
  type RespostaPaginada,
} from '@filas/contracts';
import { Prisma, type Paciente as PacienteBanco } from '@prisma/client';

import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PrismaService } from '../prisma/prisma.service';
import {
  dataIso,
  hojeIso,
  iniciais,
  normalizarNome,
  pessoaComVinculo,
  pessoaDuplicada,
  pessoaNaoEncontrada,
} from './pessoas.util';

/** Restrição só vale enquanto `restricao_ate` não passou (RN-13, Tabela 1, ID08). */
function restricaoVigente(paciente: PacienteBanco): boolean {
  return (
    paciente.restricaoAtiva &&
    (paciente.restricaoAte === null || dataIso(paciente.restricaoAte) >= hojeIso())
  );
}

function paraPaciente(paciente: PacienteBanco): Paciente {
  const vigente = restricaoVigente(paciente);
  return {
    id: paciente.id,
    nomeCompleto: paciente.nomeCompleto,
    iniciais: iniciais(paciente.nomeCompleto),
    documento: paciente.documento,
    dataNascimento: dataIso(paciente.dataNascimento),
    contatoTelefone: paciente.contatoTelefone,
    contatoEmail: paciente.contatoEmail,
    vinculo: paciente.vinculo,
    restricaoAtiva: vigente,
    restricaoAte: vigente && paciente.restricaoAte ? dataIso(paciente.restricaoAte) : null,
    ativo: paciente.ativo,
  };
}

/**
 * Paciente (Tabela 1). Duplicidade por documento ou por nome completo + nascimento
 * (docs/03 §3.2). Sempre da unidade de quem consulta (RNF-08).
 */
@Injectable()
export class PacientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    query: ListarPacientesQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<Paciente>> {
    const hoje = new Date(hojeIso());
    const digitos = query.busca?.replace(/\D/g, '');
    const where: Prisma.PacienteWhereInput = {
      unidadeId,
      ...(query.busca
        ? {
            OR: [
              { nomeCompleto: { contains: normalizarNome(query.busca), mode: 'insensitive' } },
              ...(digitos ? [{ documento: { contains: digitos } }] : []),
            ],
          }
        : {}),
      ...(query.vinculo ? { vinculo: query.vinculo } : {}),
      ...(query.comRestricao === true
        ? { restricaoAtiva: true, OR: [{ restricaoAte: null }, { restricaoAte: { gte: hoje } }] }
        : {}),
      ...(query.comRestricao === false
        ? {
            NOT: {
              restricaoAtiva: true,
              OR: [{ restricaoAte: null }, { restricaoAte: { gte: hoje } }],
            },
          }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.paciente.findMany({
        where,
        orderBy: { nomeCompleto: query.direcao },
        ...deslocamento(query),
      }),
      this.prisma.paciente.count({ where }),
    ]);
    return montarRespostaPaginada(dados.map(paraPaciente), total, query);
  }

  async consultar(id: string, unidadeId: string): Promise<PacienteDetalhe> {
    const paciente = await this.buscar(id, unidadeId);
    const vigente = restricaoVigente(paciente);
    return {
      ...paraPaciente(paciente),
      // O registro de ausência é da parte 2.2 (#7); até ele existir, a contagem é zero.
      ausenciasUltimos90Dias: 0,
      avisos: vigente
        ? [
            {
              codigo: 'PACIENTE_COM_RESTRICAO',
              mensagem: `Paciente com restrição por reincidência de ausências${
                paciente.restricaoAte ? ` até ${dataIso(paciente.restricaoAte)}` : ''
              }. A triagem continua permitida.`,
            },
          ]
        : [],
    };
  }

  async criar(entrada: PacienteEntrada, unidadeId: string): Promise<Paciente> {
    const dados = this.dados(entrada);
    await this.garantirSemDuplicidade(dados);
    try {
      return paraPaciente(await this.prisma.paciente.create({ data: { ...dados, unidadeId } }));
    } catch (erro) {
      throw await this.duplicidadeConcorrente(erro, dados);
    }
  }

  async atualizar(id: string, entrada: PacienteEntrada, unidadeId: string): Promise<Paciente> {
    await this.buscar(id, unidadeId);
    const dados = this.dados(entrada);
    await this.garantirSemDuplicidade(dados, id);
    try {
      return paraPaciente(await this.prisma.paciente.update({ where: { id }, data: dados }));
    } catch (erro) {
      throw await this.duplicidadeConcorrente(erro, dados);
    }
  }

  async alterarSituacao(id: string, ativo: boolean, unidadeId: string): Promise<Paciente> {
    await this.buscar(id, unidadeId);
    return paraPaciente(await this.prisma.paciente.update({ where: { id }, data: { ativo } }));
  }

  async excluir(id: string, unidadeId: string): Promise<void> {
    await this.buscar(id, unidadeId);
    try {
      await this.prisma.paciente.delete({ where: { id } });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw pessoaComVinculo('Paciente');
      }
      throw erro;
    }
  }

  private dados(entrada: PacienteEntrada) {
    return {
      nomeCompleto: normalizarNome(entrada.nomeCompleto),
      documento: entrada.documento,
      dataNascimento: new Date(entrada.dataNascimento),
      contatoTelefone: entrada.contatoTelefone ?? null,
      contatoEmail: entrada.contatoEmail ?? null,
      vinculo: entrada.vinculo,
    };
  }

  private async buscar(id: string, unidadeId: string): Promise<PacienteBanco> {
    const paciente = await this.prisma.paciente.findFirst({ where: { id, unidadeId } });
    if (!paciente) throw pessoaNaoEncontrada('Paciente');
    return paciente;
  }

  private async garantirSemDuplicidade(
    dados: { documento: string; nomeCompleto: string; dataNascimento: Date },
    exceto?: string,
  ): Promise<void> {
    const outro = exceto ? { NOT: { id: exceto } } : {};
    const porDocumento = await this.prisma.paciente.findFirst({
      where: { documento: dados.documento, ...outro },
      select: { id: true },
    });
    if (porDocumento) throw pessoaDuplicada('Paciente', porDocumento.id, 'esse documento');
    const porNome = await this.prisma.paciente.findFirst({
      where: {
        nomeCompleto: { equals: dados.nomeCompleto, mode: 'insensitive' },
        dataNascimento: dados.dataNascimento,
        ...outro,
      },
      select: { id: true },
    });
    if (porNome) throw pessoaDuplicada('Paciente', porNome.id, 'esse nome e data de nascimento');
  }

  private async duplicidadeConcorrente(
    erro: unknown,
    dados: { documento: string },
  ): Promise<unknown> {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const existente = await this.prisma.paciente.findFirst({
        where: { documento: dados.documento },
        select: { id: true },
      });
      if (existente) return pessoaDuplicada('Paciente', existente.id, 'esse documento');
    }
    return erro;
  }
}
