import { Injectable } from '@nestjs/common';
import { type DesistenciaEntrada, type DesistenciaResposta } from '@filas/contracts';

import { Relogio } from '../common/relogio';
import { MaquinaSenha } from '../senhas/maquina/maquina-senha.service';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { SenhasRepository } from '../senhas/senhas.repository';

/**
 * Desistência voluntária (UC-17, RF-09): só de AGUARDANDO e EM_ATENDIMENTO (a máquina recusa
 * o resto). Grava em `desistencia`, nunca em `ausencia` (W-16), e libera os recursos.
 */
@Injectable()
export class DesistenciasService {
  constructor(
    private readonly senhas: SenhasRepository,
    private readonly projecao: SenhaProjecao,
    private readonly maquina: MaquinaSenha,
    private readonly relogio: Relogio,
  ) {}

  async registrar(
    senhaId: string,
    entrada: DesistenciaEntrada,
    usuarioId: string,
    unidadeId: string,
  ): Promise<DesistenciaResposta> {
    const agora = this.relogio.agora();
    const { mudanca, senha, recursosLiberados } = await this.senhas.transacao(async (tx) => {
      const mudanca = await this.maquina.transicionar(tx, {
        senhaId,
        unidadeId,
        versao: entrada.versao,
        para: 'DESISTENCIA',
        agora,
      });
      // Atendimento interrompido: fecha a pausa e o tempo, sem desfecho (RF-10).
      const atendimento = await tx.atendimento.findUnique({
        where: { senhaId },
        select: { id: true },
      });
      if (atendimento) {
        await tx.pausaAtendimento.updateMany({
          where: { atendimentoId: atendimento.id, retomadoEm: null },
          data: { retomadoEm: agora },
        });
        await tx.atendimento.update({
          where: { id: atendimento.id },
          data: { encerradoEm: agora, versao: { increment: 1 } },
        });
      }
      const { count } = await tx.alocacao.updateMany({
        where: { senhaId, liberadaEm: null },
        data: { liberadaEm: agora },
      });
      await tx.desistencia.create({
        data: {
          senhaId,
          origem: entrada.origem,
          motivo: entrada.motivo ?? null,
          registradoPor: usuarioId,
          registradoEm: agora,
        },
      });
      const atual = (await this.senhas.buscar(senhaId, unidadeId, tx))!;
      return {
        mudanca,
        senha: await this.projecao.resumo(atual, tx),
        recursosLiberados: count > 0,
      };
    });
    this.maquina.publicar(mudanca);
    return { senha, recursosLiberados };
  }
}
