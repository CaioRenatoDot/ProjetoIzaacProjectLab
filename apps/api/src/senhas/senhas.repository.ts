import { Injectable } from '@nestjs/common';
import { type Prioridade, type Prisma, type TipoAtendimento } from '@prisma/client';

import { ALOCACAO_COMPLETA, type AlocacaoCompleta } from '../alocacao/alocacao.projecao';
import { PrismaService } from '../prisma/prisma.service';

export const SENHA_COMPLETA = {
  paciente: { select: { nomeCompleto: true } },
  fila: {
    select: {
      unidadeId: true,
      especialidadeId: true,
      slaMinutos: true,
      bloqueada: true,
      especialidade: { select: { nome: true } },
    },
  },
  chamadas: { orderBy: { sequencia: 'desc' }, take: 1, select: { id: true } },
} satisfies Prisma.SenhaInclude;

export type SenhaCompleta = Prisma.SenhaGetPayload<{ include: typeof SENHA_COMPLETA }>;
export type Transacao = Prisma.TransactionClient;

export interface NovaSenha {
  numero: string;
  filaId: string;
  triagemId: string;
  pacienteId: string;
  prioridade: Prioridade;
  tipoAtendimento: TipoAtendimento;
  temAgendamentoPrevio: boolean;
}

@Injectable()
export class SenhasRepository {
  constructor(private readonly prisma: PrismaService) {}

  transacao<T>(trabalho: (tx: Transacao) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabalho);
  }

  /** Bloqueia a triagem até o fim da transação: duas emissões da mesma triagem se enfileiram. */
  async triagemBloqueada(
    tx: Transacao,
    triagemId: string,
    unidadeId: string,
  ): Promise<{
    id: string;
    pacienteId: string;
    especialidadeDestinoId: string;
    prioridade: Prioridade;
    tipoAtendimento: TipoAtendimento;
  } | null> {
    const [triagem] = await tx.$queryRaw<
      {
        id: string;
        paciente_id: string;
        especialidade_destino_id: string;
        prioridade: Prioridade;
        tipo_atendimento: TipoAtendimento;
      }[]
    >`
      SELECT t.id, t.paciente_id, t.especialidade_destino_id, t.prioridade, t.tipo_atendimento
        FROM triagem t
        JOIN paciente p ON p.id = t.paciente_id
       WHERE t.id = ${triagemId}::uuid AND p.unidade_id = ${unidadeId}::uuid
         FOR UPDATE OF t`;
    return triagem
      ? {
          id: triagem.id,
          pacienteId: triagem.paciente_id,
          especialidadeDestinoId: triagem.especialidade_destino_id,
          prioridade: triagem.prioridade,
          tipoAtendimento: triagem.tipo_atendimento,
        }
      : null;
  }

  senhaDaTriagem(tx: Transacao, triagemId: string): Promise<{ id: string } | null> {
    return tx.senha.findFirst({ where: { triagemId }, select: { id: true } });
  }

  filaAtiva(
    tx: Transacao,
    especialidadeId: string,
    unidadeId: string,
  ): Promise<{ id: string; letraSenha: string } | null> {
    return tx.fila.findFirst({
      where: { especialidadeId, unidadeId, ativa: true },
      select: { id: true, letraSenha: true },
    });
  }

  /** Próxima sequência do dia (fuso da unidade) na fila; o upsert serializa emissões simultâneas. */
  async proximaSequencia(tx: Transacao, filaId: string): Promise<number> {
    const [linha] = await tx.$queryRaw<{ ultimo: number }[]>`
      INSERT INTO contador_senha (fila_id, dia, ultimo)
      VALUES (${filaId}::uuid, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
      ON CONFLICT (fila_id, dia) DO UPDATE SET ultimo = contador_senha.ultimo + 1
      RETURNING ultimo`;
    return linha!.ultimo;
  }

  criar(tx: Transacao, dados: NovaSenha): Promise<{ id: string }> {
    return tx.senha.create({ data: dados, select: { id: true } });
  }

  buscar(id: string, unidadeId: string, tx?: Transacao): Promise<SenhaCompleta | null> {
    return (tx ?? this.prisma).senha.findFirst({
      where: { id, fila: { unidadeId } },
      include: SENHA_COMPLETA,
    });
  }

  /** Muda a prioridade só se a versão ainda for a lida (bloqueio otimista, docs/04 §6). */
  async reclassificar(
    tx: Transacao,
    id: string,
    versao: number,
    prioridade: Prioridade,
  ): Promise<boolean> {
    const { count } = await tx.senha.updateMany({
      where: { id, versao },
      data: { prioridade, versao: { increment: 1 } },
    });
    return count === 1;
  }

  registrarReclassificacao(
    tx: Transacao,
    dados: {
      senhaId: string;
      dePrioridade: Prioridade;
      paraPrioridade: Prioridade;
      justificativa: string;
      usuarioId: string;
    },
  ): Promise<unknown> {
    return tx.reclassificacaoPrioridade.create({ data: dados });
  }

  alocacaoVigente(senhaId: string): Promise<AlocacaoCompleta | null> {
    return this.prisma.alocacao.findFirst({
      where: { senhaId, liberadaEm: null },
      include: ALOCACAO_COMPLETA,
    });
  }

  reclassificacoes(senhaId: string) {
    return this.prisma.reclassificacaoPrioridade.findMany({
      where: { senhaId },
      include: { usuario: { select: { nome: true } } },
      orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Posição pela RN-04 entre as senhas AGUARDANDO de cada fila: prioridade, chegada e
   * agendamento prévio, nessa precedência (o enum Prioridade está em ordem crescente). O id
   * desempata. Uma consulta para todas as filas pedidas.
   */
  async posicoes(filaIds: string[], tx?: Transacao): Promise<Map<string, number>> {
    if (!filaIds.length) return new Map();
    const linhas = await (tx ?? this.prisma).$queryRaw<{ id: string; posicao: bigint }[]>`
      SELECT id, ROW_NUMBER() OVER (
               PARTITION BY fila_id
               ORDER BY prioridade DESC, chegada_em ASC, tem_agendamento_previo DESC, id ASC
             ) AS posicao
        FROM senha
       WHERE fila_id = ANY(${filaIds}::uuid[]) AND status = 'AGUARDANDO'`;
    return new Map(linhas.map((linha) => [linha.id, Number(linha.posicao)]));
  }

  async posicao(senhaId: string, filaId: string, tx?: Transacao): Promise<number | null> {
    return (await this.posicoes([filaId], tx)).get(senhaId) ?? null;
  }
}
