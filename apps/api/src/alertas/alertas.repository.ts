import { Injectable } from '@nestjs/common';
import { type ConsultarAlertasQuery, type TipoAlerta } from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type TransacaoAlerta = Prisma.TransactionClient;
const selecao = {
  id: true,
  tipo: true,
  status: true,
  filaId: true,
  tempoEsperaMinutos: true,
  limiteMinutos: true,
  senhasAfetadas: true,
  disparadoEm: true,
  reconhecidoEm: true,
  normalizadoEm: true,
  fila: { select: { especialidade: { select: { nome: true } } } },
  reconhecedor: { select: { nome: true } },
  escalonamentos: {
    orderBy: [{ acionadoEm: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      alertaId: true,
      acao: true,
      observacao: true,
      acionadoEm: true,
      autor: { select: { nome: true } },
    },
  },
} satisfies Prisma.AlertaSelect;
export type RegistroAlerta = Prisma.AlertaGetPayload<{ select: typeof selecao }>;

@Injectable()
export class AlertasRepository {
  constructor(private readonly prisma: PrismaService) {}

  transacao<T>(trabalho: (tx: TransacaoAlerta) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabalho, { maxWait: 10_000, timeout: 20_000 });
  }

  filasAtivas() {
    return this.prisma.fila.findMany({
      where: { ativa: true },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
  }

  recuperarBloqueios() {
    return this.prisma.fila.findMany({
      where: {
        OR: [
          { bloqueada: true },
          {
            alertas: { some: { tipo: 'FILA_BLOQUEADA', status: { in: ['ATIVO', 'RECONHECIDO'] } } },
          },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
  }

  async fila(tx: TransacaoAlerta, id: string) {
    const [fila] = await tx.$queryRaw<
      {
        id: string;
        unidadeId: string;
        especialidadeId: string;
        ativa: boolean;
        bloqueada: boolean;
        bloqueadaDesde: Date | null;
        slaMinutos: number | null;
      }[]
    >`SELECT id, unidade_id AS "unidadeId", especialidade_id AS "especialidadeId", ativa,
        bloqueada, bloqueada_desde AS "bloqueadaDesde", sla_minutos AS "slaMinutos"
        FROM fila WHERE id = ${id}::uuid FOR UPDATE`;
    return fila ?? null;
  }

  async espera(tx: TransacaoAlerta, filaId: string, antesDe: Date) {
    const [linha] = await tx.$queryRaw<
      { maisAntiga: Date | null; aguardando: number; acima: number }[]
    >`
      SELECT MIN(chegada_em) AS "maisAntiga", COUNT(*)::int AS aguardando,
        COUNT(*) FILTER (WHERE chegada_em < ${antesDe})::int AS acima
        FROM senha WHERE fila_id = ${filaId}::uuid AND status = 'AGUARDANDO'`;
    return linha!;
  }

  aberto(tx: TransacaoAlerta, filaId: string, tipo: TipoAlerta) {
    return tx.alerta.findFirst({
      where: { filaId, tipo, status: { in: ['ATIVO', 'RECONHECIDO'] } },
      select: { id: true },
    });
  }

  async bloquear(tx: TransacaoAlerta, id: string, unidadeId: string) {
    const linhas = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM alerta WHERE id = ${id}::uuid AND unidade_id = ${unidadeId}::uuid FOR UPDATE`;
    return linhas.length ? this.buscar(tx, id) : null;
  }

  buscar(tx: TransacaoAlerta, id: string) {
    return tx.alerta.findUniqueOrThrow({ where: { id }, select: selecao });
  }

  criar(tx: TransacaoAlerta, data: Prisma.AlertaUncheckedCreateInput) {
    return tx.alerta.create({ data, select: selecao });
  }

  reconhecer(tx: TransacaoAlerta, id: string, usuarioId: string, agora: Date) {
    return tx.alerta.update({
      where: { id },
      data: { status: 'RECONHECIDO', reconhecidoPor: usuarioId, reconhecidoEm: agora },
      select: selecao,
    });
  }

  normalizar(tx: TransacaoAlerta, id: string, agora: Date) {
    return tx.alerta.update({
      where: { id },
      data: { status: 'NORMALIZADO', normalizadoEm: agora },
      select: { id: true },
    });
  }

  escalonar(tx: TransacaoAlerta, data: Prisma.EscalonamentoUncheckedCreateInput) {
    return tx.escalonamento.create({
      data,
      select: {
        id: true,
        alertaId: true,
        acao: true,
        observacao: true,
        acionadoEm: true,
        autor: { select: { nome: true } },
      },
    });
  }

  async listar(unidadeId: string, q: ConsultarAlertasQuery) {
    const filtros = [Prisma.sql`a.unidade_id = ${unidadeId}::uuid`];
    if (q.status?.length) filtros.push(Prisma.sql`a.status::text IN (${Prisma.join(q.status)})`);
    if (q.filaId) filtros.push(Prisma.sql`a.fila_id = ${q.filaId}::uuid`);
    if (q.de) filtros.push(Prisma.sql`a.disparado_em >= ${new Date(q.de)}`);
    if (q.ate) filtros.push(Prisma.sql`a.disparado_em <= ${new Date(q.ate)}`);
    const onde = Prisma.join(filtros, ' AND ');
    return this.prisma.$transaction(
      async (tx) => {
        const [contagem] = await tx.$queryRaw<
          { total: number }[]
        >`SELECT COUNT(*)::int AS total FROM alerta a WHERE ${onde}`;
        const ids = await tx.$queryRaw<{ id: string }[]>`
        SELECT a.id FROM alerta a WHERE ${onde}
        ORDER BY CASE a.status WHEN 'ATIVO' THEN 0 WHEN 'RECONHECIDO' THEN 1 ELSE 2 END,
          CASE WHEN a.status <> 'NORMALIZADO' AND a.tipo = 'FILA_BLOQUEADA' THEN 0 ELSE 1 END,
          CASE WHEN a.status <> 'NORMALIZADO' THEN COALESCE(a.tempo_espera_minutos - a.limite_minutos, 0) ELSE 0 END DESC,
          CASE WHEN a.status = 'NORMALIZADO' THEN a.normalizado_em ELSE a.disparado_em END DESC,
          a.id ASC LIMIT ${q.tamanho} OFFSET ${(q.pagina - 1) * q.tamanho}`;
        const linhas = await tx.alerta.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
          select: selecao,
        });
        const porId = new Map(linhas.map((r) => [r.id, r]));
        return { registros: ids.map(({ id }) => porId.get(id)!), total: contagem!.total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
