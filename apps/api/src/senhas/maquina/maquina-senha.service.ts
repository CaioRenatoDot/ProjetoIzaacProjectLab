import { Injectable } from '@nestjs/common';
import { type EventosFila, type StatusSenha } from '@filas/contracts';

import { EventosDominio } from '../../common/eventos/eventos-dominio';
import { ErroDominio } from '../../common/errors/erro-dominio';
import { ParametrosService } from '../../parametros/parametros.service';
import { SenhaProjecao } from '../senha-projecao.service';
import { type Transacao } from '../senhas.repository';
import { horariosDaTransicao, transicaoPermitida } from './transicoes';

export type MudancaStatus = EventosFila['senha.status_alterado'];

export interface PedidoTransicao {
  senhaId: string;
  unidadeId: string;
  /** Versão que o cliente leu (docs/04 §6). */
  versao: number;
  para: StatusSenha;
  agora?: Date;
}

/**
 * Única forma de mudar o status de uma senha (docs/03 §5). Roda dentro da transação de quem
 * chama, junto com os efeitos colaterais (alocação, ausência etc.); quem chama publica a
 * mudança com `publicar` **depois** do commit.
 */
@Injectable()
export class MaquinaSenha {
  constructor(
    private readonly projecao: SenhaProjecao,
    private readonly parametros: ParametrosService,
    private readonly eventos: EventosDominio,
  ) {}

  async transicionar(tx: Transacao, pedido: PedidoTransicao): Promise<MudancaStatus> {
    const senha = await tx.senha.findFirst({
      where: { id: pedido.senhaId, fila: { unidadeId: pedido.unidadeId } },
      select: {
        id: true,
        status: true,
        versao: true,
        filaId: true,
        fila: { select: { especialidadeId: true } },
      },
    });
    if (!senha) {
      throw new ErroDominio(
        'NAO_ENCONTRADO',
        404,
        'Senha não encontrada',
        'O registro não existe ou foi removido.',
      );
    }
    if (senha.versao !== pedido.versao) {
      throw await this.projecao.versaoDesatualizada(senha.id, pedido.unidadeId);
    }
    if (!transicaoPermitida(senha.status, pedido.para)) {
      throw new ErroDominio(
        'TRANSICAO_INVALIDA',
        409,
        'Ação indisponível para esta senha',
        `A senha está em ${senha.status} e não pode passar para ${pedido.para}.`,
        { statusAtual: senha.status },
      );
    }

    const toleranciaMinutos =
      pedido.para === 'CHAMADA'
        ? (await this.parametros.vigentes(pedido.unidadeId, senha.fila.especialidadeId))
            .toleranciaMinutos
        : 0;
    const { count } = await tx.senha.updateMany({
      where: { id: senha.id, versao: senha.versao, status: senha.status },
      data: {
        status: pedido.para,
        versao: { increment: 1 },
        ...horariosDaTransicao(
          senha.status,
          pedido.para,
          pedido.agora ?? new Date(),
          toleranciaMinutos,
        ),
      },
    });
    if (count !== 1) {
      throw await this.projecao.versaoDesatualizada(senha.id, pedido.unidadeId);
    }
    return {
      senhaId: senha.id,
      filaId: senha.filaId,
      statusAnterior: senha.status,
      status: pedido.para,
      versao: senha.versao + 1,
    };
  }

  publicar(mudanca: MudancaStatus): void {
    this.eventos.emitir('senha.status_alterado', mudanca);
  }
}
