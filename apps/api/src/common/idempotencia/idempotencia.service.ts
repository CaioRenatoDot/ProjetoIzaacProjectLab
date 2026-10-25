import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import { ErroValidacao } from '../errors/erro-dominio';
import { PrismaService } from '../../prisma/prisma.service';

/** Janela em que a mesma chave devolve a resposta original (docs/04 §6). */
const JANELA_MS = 10 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PedidoIdempotente {
  usuarioId: string;
  /** Valor do header `Idempotency-Key`; sem ele, a operação roda normalmente. */
  chave: string | undefined;
  /** Método e rota; o corpo entra no hash para a chave não valer com outro corpo. */
  operacao: string;
  corpo: unknown;
}

export interface ResultadoIdempotente<T> {
  corpo: T;
  /** Efeitos depois do commit (eventos); só rodam em quem executou de fato. */
  aposCommit?: () => void;
}

const chaveEmOutraOperacao = () =>
  new ErroValidacao([
    {
      campo: 'Idempotency-Key',
      mensagem: 'Esta chave já foi usada em outra operação. Gere uma chave nova.',
    },
  ]);

/**
 * `Idempotency-Key` da chamada e da alocação. A resposta é gravada na mesma transação da
 * operação: uma requisição simultânea com a mesma chave espera o commit da primeira no índice
 * da chave, falha com P2002, desfaz o que fez e devolve a resposta gravada.
 */
@Injectable()
export class IdempotenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async executar<T>(
    pedido: PedidoIdempotente,
    trabalho: (tx: Prisma.TransactionClient) => Promise<ResultadoIdempotente<T>>,
  ): Promise<T> {
    if (pedido.chave === undefined) {
      const resultado = await this.prisma.$transaction(trabalho);
      resultado.aposCommit?.();
      return resultado.corpo;
    }
    const chave = pedido.chave.trim();
    if (!UUID.test(chave)) {
      throw new ErroValidacao([
        { campo: 'Idempotency-Key', mensagem: 'Envie um UUID no Idempotency-Key.' },
      ]);
    }
    const operacao = `${pedido.operacao} ${createHash('sha256')
      .update(JSON.stringify(pedido.corpo ?? {}))
      .digest('hex')}`;

    const gravada = await this.respostaGravada(pedido.usuarioId, chave, operacao);
    if (gravada !== undefined) return gravada as T;

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        await tx.chaveIdempotencia.deleteMany({
          where: {
            usuarioId: pedido.usuarioId,
            chave,
            criadoEm: { lt: new Date(Date.now() - JANELA_MS) },
          },
        });
        const executado = await trabalho(tx);
        await tx.chaveIdempotencia.create({
          data: {
            usuarioId: pedido.usuarioId,
            chave,
            operacao,
            statusHttp: 201,
            resposta: executado.corpo as Prisma.InputJsonValue,
          },
        });
        return executado;
      });
      resultado.aposCommit?.();
      return resultado.corpo;
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const concorrente = await this.respostaGravada(pedido.usuarioId, chave, operacao);
        if (concorrente !== undefined) return concorrente as T;
      }
      throw erro;
    }
  }

  private async respostaGravada(
    usuarioId: string,
    chave: string,
    operacao: string,
  ): Promise<unknown> {
    const registro = await this.prisma.chaveIdempotencia.findUnique({
      where: { usuarioId_chave: { usuarioId, chave } },
    });
    if (!registro || registro.criadoEm.getTime() < Date.now() - JANELA_MS) return undefined;
    if (registro.operacao !== operacao) throw chaveEmOutraOperacao();
    return registro.resposta;
  }
}

@Global()
@Module({ providers: [IdempotenciaService], exports: [IdempotenciaService] })
export class IdempotenciaModule {}
