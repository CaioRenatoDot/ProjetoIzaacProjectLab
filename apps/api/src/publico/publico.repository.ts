import { Injectable } from '@nestjs/common';
import { type StatusSenha } from '@filas/contracts';

import { PrismaService } from '../prisma/prisma.service';

export interface SenhaParaConsulta {
  numero: string;
  especialidade: string;
  status: StatusSenha;
  posicao: number | null;
  local: string | null;
  amostra: number;
  media: number | null;
}

@Injectable()
export class PublicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  consultar(numero: string, agora: Date): Promise<SenhaParaConsulta[]> {
    return this.prisma.$queryRaw<SenhaParaConsulta[]>`
      SELECT s.numero, e.nome AS especialidade, s.status,
        (SELECT ordem.posicao::int FROM (
          SELECT id, row_number() OVER (
            ORDER BY prioridade DESC, chegada_em ASC, tem_agendamento_previo DESC, id ASC
          ) AS posicao FROM senha WHERE fila_id = s.fila_id AND status = 'AGUARDANDO'
        ) ordem WHERE ordem.id = s.id) AS posicao,
        (SELECT local_exibicao FROM chamada WHERE senha_id = s.id
          ORDER BY chamado_em DESC, id DESC LIMIT 1) AS local,
        estatistica.amostra, estatistica.media
      FROM senha s JOIN fila f ON f.id = s.fila_id
        JOIN especialidade e ON e.id = f.especialidade_id
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS amostra,
            avg(extract(epoch FROM (primeira - chegada_em)) / 60)::float AS media
          FROM (
            SELECT a.chegada_em, min(c.chamado_em) AS primeira
            FROM senha a JOIN chamada c ON c.senha_id = a.id
            WHERE a.fila_id = s.fila_id
              AND (a.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date
                = (${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
            GROUP BY a.id
          ) amostras WHERE primeira >= chegada_em AND primeira <= ${agora}
        ) estatistica
      WHERE s.numero = ${numero}
        AND (s.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date
          = (${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
      LIMIT 2`;
  }
}
