import { Injectable } from '@nestjs/common';
import {
  type ListarTriagensQuery,
  prioridadeEfetiva,
  type RespostaPaginada,
  type TriagemDetalhe,
  type TriagemEntrada,
  type TriagemResumo,
} from '@filas/contracts';
import { type Prisma } from '@prisma/client';

import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { iniciais } from '../cadastros/pessoas.util';
import { TriagemRepository, type TriagemComRelacoes } from './triagem.repository';

/** O MVP tem uma unidade, em Brasília (sem horário de verão desde 2019). */
const FUSO_UNIDADE = '-03:00';

function paraResumo(triagem: TriagemComRelacoes): TriagemResumo {
  return {
    id: triagem.id,
    pacienteIniciais: iniciais(triagem.paciente.nomeCompleto),
    especialidadeId: triagem.especialidadeDestinoId,
    especialidade: triagem.especialidadeDestino.nome,
    tipoAtendimento: triagem.tipoAtendimento,
    prioridade: triagem.prioridade,
    concluidaEm: triagem.concluidaEm.toISOString(),
    senhaEmitida: triagem._count.senhas > 0,
  };
}

function paraDetalhe(triagem: TriagemComRelacoes): TriagemDetalhe {
  return {
    ...paraResumo(triagem),
    pacienteId: triagem.pacienteId,
    pacienteNome: triagem.paciente.nomeCompleto,
    motivo: triagem.motivo,
    enquadramentoLegal: triagem.enquadramentoLegal,
    justificativaClinica: triagem.justificativaClinica,
    observacoes: triagem.observacoes,
    profissionalId: triagem.profissionalId,
  };
}

/** Dia seguinte a uma data AAAA-MM-DD, para o filtro `ate` incluir o dia inteiro. */
function diaSeguinte(data: string): string {
  const dia = new Date(`${data}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().slice(0, 10);
}

/**
 * Triagem (UC-05, RF-03). A prioridade gravada é a efetiva (RN-02) e a urgência exige
 * justificativa clínica (RN-03); o CHECK do banco é a última barreira (docs/03 §4).
 */
@Injectable()
export class TriagemService {
  constructor(private readonly repositorio: TriagemRepository) {}

  async registrar(
    entrada: TriagemEntrada,
    profissionalId: string,
    unidadeId: string,
  ): Promise<TriagemDetalhe> {
    const justificativaClinica = entrada.justificativaClinica?.trim() || null;
    if (entrada.prioridade === 'URGENTE' && !justificativaClinica) {
      throw new ErroValidacao([
        {
          campo: 'justificativaClinica',
          mensagem: 'Justificativa é obrigatória para prioridade Urgente.',
        },
      ]);
    }
    const [paciente, especialidade] = await Promise.all([
      this.repositorio.pacienteAtivo(entrada.pacienteId, unidadeId),
      this.repositorio.especialidadeComFila(entrada.especialidadeDestinoId, unidadeId),
    ]);
    const campos = [
      ...(paciente
        ? []
        : [{ campo: 'pacienteId', mensagem: 'Paciente não encontrado ou inativo.' }]),
      ...(especialidade
        ? []
        : [
            {
              campo: 'especialidadeDestinoId',
              mensagem: 'Escolha uma especialidade ativa com fila configurada.',
            },
          ]),
    ];
    if (campos.length) throw new ErroValidacao(campos);

    const triagem = await this.repositorio.criar({
      pacienteId: entrada.pacienteId,
      profissionalId,
      especialidadeDestinoId: entrada.especialidadeDestinoId,
      tipoAtendimento: entrada.tipoAtendimento,
      prioridade: prioridadeEfetiva(entrada.prioridade, entrada.enquadramentoLegal),
      motivo: entrada.motivo,
      enquadramentoLegal: entrada.enquadramentoLegal ?? null,
      justificativaClinica,
      observacoes: entrada.observacoes?.trim() || null,
    });
    return paraDetalhe(triagem);
  }

  async listar(
    query: ListarTriagensQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<TriagemResumo>> {
    const where: Prisma.TriagemWhereInput = {
      paciente: { unidadeId },
      ...(query.pacienteId ? { pacienteId: query.pacienteId } : {}),
      ...(query.especialidadeId ? { especialidadeDestinoId: query.especialidadeId } : {}),
      ...(query.emAberto === true ? { senhas: { none: {} } } : {}),
      ...(query.emAberto === false ? { senhas: { some: {} } } : {}),
      ...(query.de || query.ate
        ? {
            concluidaEm: {
              ...(query.de ? { gte: new Date(`${query.de}T00:00:00${FUSO_UNIDADE}`) } : {}),
              ...(query.ate
                ? { lt: new Date(`${diaSeguinte(query.ate)}T00:00:00${FUSO_UNIDADE}`) }
                : {}),
            },
          }
        : {}),
    };
    const [dados, total] = await this.repositorio.listar(where, deslocamento(query));
    return montarRespostaPaginada(dados.map(paraResumo), total, query);
  }

  async consultar(id: string, unidadeId: string): Promise<TriagemDetalhe> {
    const triagem = await this.repositorio.buscar(id, unidadeId);
    if (!triagem) {
      throw new ErroDominio(
        'NAO_ENCONTRADO',
        404,
        'Triagem não encontrada',
        'O registro não existe ou foi removido.',
      );
    }
    return paraDetalhe(triagem);
  }
}
