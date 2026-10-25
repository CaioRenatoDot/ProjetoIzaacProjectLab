import { Injectable } from '@nestjs/common';
import {
  type Fila,
  type FilaEntrada,
  type ListarFilasQuery,
  type QuadroFila,
  type QuadroFilaQuery,
  type RespostaPaginada,
  STATUS_DO_QUADRO,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { ParametrosService } from '../parametros/parametros.service';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { type FilaCompleta, FilasRepository } from './filas.repository';

export const filaNaoEncontrada = () =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    'Fila não encontrada',
    'O registro não existe ou foi removido.',
  );

/** Cadastro de filas e quadro ordenado (RF-04, RN-04). */
@Injectable()
export class FilasService {
  constructor(
    private readonly repositorio: FilasRepository,
    private readonly parametros: ParametrosService,
    private readonly projecao: SenhaProjecao,
  ) {}

  async listar(query: ListarFilasQuery, unidadeId: string): Promise<RespostaPaginada<Fila>> {
    const where: Prisma.FilaWhereInput = {
      unidadeId,
      ...(query.especialidadeId ? { especialidadeId: query.especialidadeId } : {}),
      ...(query.ativa !== undefined ? { ativa: query.ativa } : {}),
    };
    const [filas, total] = await this.repositorio.listar(where, deslocamento(query));
    return montarRespostaPaginada(
      await Promise.all(filas.map((fila) => this.paraFila(fila))),
      total,
      query,
    );
  }

  async consultar(id: string, unidadeId: string): Promise<Fila> {
    return this.paraFila(await this.buscar(id, unidadeId));
  }

  async criar(entrada: FilaEntrada, unidadeId: string): Promise<Fila> {
    await this.validar(entrada, unidadeId);
    return this.paraFila(
      await this.gravar(entrada, unidadeId, () =>
        this.repositorio.criar({
          nome: entrada.nome,
          especialidadeId: entrada.especialidadeId,
          unidadeId,
          letraSenha: entrada.letraSenha,
          ativa: entrada.ativa,
          slaMinutos: entrada.slaMinutos ?? null,
        }),
      ),
    );
  }

  async atualizar(id: string, entrada: FilaEntrada, unidadeId: string): Promise<Fila> {
    await this.buscar(id, unidadeId);
    await this.validar(entrada, unidadeId, id);
    return this.paraFila(
      await this.gravar(
        entrada,
        unidadeId,
        () =>
          this.repositorio.atualizar(id, {
            nome: entrada.nome,
            especialidadeId: entrada.especialidadeId,
            letraSenha: entrada.letraSenha,
            ativa: entrada.ativa,
            slaMinutos: entrada.slaMinutos ?? null,
          }),
        id,
      ),
    );
  }

  async excluir(id: string, unidadeId: string): Promise<void> {
    await this.buscar(id, unidadeId);
    const senhas = await this.repositorio.contarSenhas(id);
    if (senhas) throw vinculoAtivo(`${senhas} senha(s)`);
    try {
      await this.repositorio.excluir(id);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2003') {
        throw vinculoAtivo('outros registros (alertas)');
      }
      throw erro;
    }
  }

  async quadro(id: string, query: QuadroFilaQuery, unidadeId: string): Promise<QuadroFila> {
    const fila = await this.buscar(id, unidadeId);
    const [[senhas, total], metricas] = await Promise.all([
      this.repositorio.quadro(
        id,
        query.status?.length ? query.status : [...STATUS_DO_QUADRO],
        query.tipoAtendimento,
        deslocamento(query),
      ),
      this.repositorio.metricas(id),
    ]);
    const { dados, meta } = montarRespostaPaginada(
      await this.projecao.resumos(senhas),
      total,
      query,
    );
    return {
      fila: await this.paraFila(fila),
      metricas,
      dados,
      meta,
      sincronizadoEm: new Date().toISOString(),
    };
  }

  async buscar(id: string, unidadeId: string): Promise<FilaCompleta> {
    const fila = await this.repositorio.buscar(id, unidadeId);
    if (!fila) throw filaNaoEncontrada();
    return fila;
  }

  async paraFila(fila: FilaCompleta): Promise<Fila> {
    const vigentes = await this.parametros.vigentes(fila.unidadeId, fila.especialidadeId);
    return {
      id: fila.id,
      nome: fila.nome,
      especialidadeId: fila.especialidadeId,
      especialidade: fila.especialidade.nome,
      letraSenha: fila.letraSenha,
      ativa: fila.ativa,
      slaMinutos: fila.slaMinutos ?? vigentes.slaMinutos,
      toleranciaMinutos: vigentes.toleranciaMinutos,
      bloqueio: {
        ativo: fila.bloqueada,
        motivo: fila.bloqueada ? fila.bloqueadaMotivo : null,
        desde: fila.bloqueada ? (fila.bloqueadaDesde?.toISOString() ?? null) : null,
      },
    };
  }

  private async validar(entrada: FilaEntrada, unidadeId: string, exceto?: string): Promise<void> {
    if (!(await this.repositorio.especialidadeAtiva(entrada.especialidadeId, unidadeId))) {
      throw new ErroValidacao([
        { campo: 'especialidadeId', mensagem: 'Escolha uma especialidade ativa.' },
      ]);
    }
    if (entrada.ativa) {
      const outra = await this.repositorio.filaAtivaDaEspecialidade(
        entrada.especialidadeId,
        unidadeId,
        exceto,
      );
      if (outra) throw filaAtivaDuplicada(outra.id);
    }
  }

  /** O único parcial da RF-04 também pega a corrida entre duas criações. */
  private async gravar(
    entrada: FilaEntrada,
    unidadeId: string,
    escrita: () => Promise<FilaCompleta>,
    exceto?: string,
  ): Promise<FilaCompleta> {
    try {
      return await escrita();
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const outra = await this.repositorio.filaAtivaDaEspecialidade(
          entrada.especialidadeId,
          unidadeId,
          exceto,
        );
        if (outra) throw filaAtivaDuplicada(outra.id);
      }
      throw erro;
    }
  }
}

const filaAtivaDuplicada = (recursoExistenteId: string) =>
  new ErroDominio(
    'DUPLICIDADE',
    409,
    'Especialidade já tem fila ativa',
    'Cada especialidade tem uma fila ativa por vez. Inative a fila atual ou edite-a.',
    { recursoExistenteId },
  );

const vinculoAtivo = (vinculos: string) =>
  new ErroDominio(
    'VINCULO_ATIVO',
    409,
    'Registro com vínculo ativo',
    `A fila está vinculada a ${vinculos} e não pode ser excluída. Você pode inativá-la: ela deixa de receber senhas e o histórico é mantido.`,
  );
