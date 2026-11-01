import { Injectable } from '@nestjs/common';
import { Prisma, type Turno } from '@prisma/client';

import { HORAS_DO_TURNO } from '../common/turno';
import { PrismaService } from '../prisma/prisma.service';

export interface FiltroIndicadores {
  unidadeId: string;
  de: string;
  ate: string;
  especialidadeId?: string;
  turno?: Turno;
}

/** Uma linha por especialidade e uma de total geral (`geral`), já agregadas no banco. */
export interface LinhaIndicadores {
  especialidade_id: string | null;
  especialidade: string | null;
  geral: boolean;
  senhas: number;
  espera: number | null;
  duracao: number | null;
  atendidos: number;
  chamadas: number;
  ausencias: number;
  desistencias: number;
}

@Injectable()
export class IndicadoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Coorte: senhas que chegaram no período (dias inteiros no fuso da unidade). Espera até a
   * primeira chamada (ROW_NUMBER), duração descontando pausas, contagens com FILTER e o total
   * geral por GROUPING SETS. Nada de paciente sai daqui (RNF-02).
   */
  agregar(filtro: FiltroIndicadores): Promise<LinhaIndicadores[]> {
    const especialidade = filtro.especialidadeId
      ? Prisma.sql`AND f.especialidade_id = ${filtro.especialidadeId}::uuid`
      : Prisma.empty;
    const turno = filtro.turno
      ? Prisma.sql`AND extract(hour FROM s.chegada_em AT TIME ZONE 'America/Sao_Paulo')
                     >= ${HORAS_DO_TURNO[filtro.turno][0]}
                   AND extract(hour FROM s.chegada_em AT TIME ZONE 'America/Sao_Paulo')
                     < ${HORAS_DO_TURNO[filtro.turno][1]}`
      : Prisma.empty;
    return this.prisma.$queryRaw<LinhaIndicadores[]>`
      WITH coorte AS (
        SELECT s.id, s.chegada_em, f.especialidade_id
          FROM senha s
          JOIN fila f ON f.id = s.fila_id
         WHERE f.unidade_id = ${filtro.unidadeId}::uuid
           AND s.chegada_em >= (${filtro.de}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
           AND s.chegada_em < ((${filtro.ate}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
           ${especialidade}
           ${turno}
      ),
      primeira_chamada AS (
        SELECT senha_id, chamado_em
          FROM (
            SELECT c.senha_id, c.chamado_em,
                   ROW_NUMBER() OVER (PARTITION BY c.senha_id ORDER BY c.chamado_em, c.sequencia) AS ordem
              FROM chamada c
              JOIN coorte k ON k.id = c.senha_id
          ) chamadas
         WHERE ordem = 1
      ),
      pausas AS (
        SELECT p.atendimento_id,
               sum(extract(epoch FROM
                 least(coalesce(p.retomado_em, a.encerrado_em), a.encerrado_em) - p.pausado_em)) AS segundos
          FROM pausa_atendimento p
          JOIN atendimento a ON a.id = p.atendimento_id
          JOIN coorte k ON k.id = a.senha_id
         WHERE a.encerrado_em IS NOT NULL
         GROUP BY p.atendimento_id
      ),
      por_senha AS (
        SELECT k.especialidade_id,
               extract(epoch FROM pc.chamado_em - k.chegada_em) / 60 AS espera,
               CASE WHEN a.desfecho IS NOT NULL THEN
                 greatest(0, extract(epoch FROM a.encerrado_em - a.iniciado_em) - coalesce(ps.segundos, 0)) / 60
               END AS duracao,
               a.desfecho IS NOT NULL AS atendido,
               pc.senha_id IS NOT NULL AS chamada,
               EXISTS (SELECT 1 FROM ausencia au WHERE au.senha_id = k.id) AS ausente,
               EXISTS (SELECT 1 FROM desistencia d WHERE d.senha_id = k.id) AS desistiu
          FROM coorte k
          LEFT JOIN primeira_chamada pc ON pc.senha_id = k.id
          LEFT JOIN atendimento a ON a.senha_id = k.id
          LEFT JOIN pausas ps ON ps.atendimento_id = a.id
      )
      SELECT p.especialidade_id,
             e.nome AS especialidade,
             GROUPING(p.especialidade_id) = 1 AS geral,
             count(*)::int AS senhas,
             round(avg(p.espera))::int AS espera,
             round(avg(p.duracao))::int AS duracao,
             (count(*) FILTER (WHERE p.atendido))::int AS atendidos,
             (count(*) FILTER (WHERE p.chamada))::int AS chamadas,
             (count(*) FILTER (WHERE p.ausente))::int AS ausencias,
             (count(*) FILTER (WHERE p.desistiu))::int AS desistencias
        FROM por_senha p
        LEFT JOIN especialidade e ON e.id = p.especialidade_id
       GROUP BY GROUPING SETS ((p.especialidade_id, e.nome), ())
       ORDER BY geral DESC, especialidade`;
  }
}
