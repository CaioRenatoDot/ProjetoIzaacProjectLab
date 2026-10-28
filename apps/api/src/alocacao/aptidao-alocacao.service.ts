import { Injectable } from '@nestjs/common';

import { type AlocacaoRepository } from './alocacao.repository';
import { type CandidatoAlocacao } from './dto/sugestoes.dto';

type Estudante = Awaited<ReturnType<AlocacaoRepository['estudante']>>;
type Supervisor = Awaited<ReturnType<AlocacaoRepository['supervisor']>>;
type Sala = Awaited<ReturnType<AlocacaoRepository['sala']>>;
export interface Inaptidao {
  status: 422 | 409;
  motivo: NonNullable<CandidatoAlocacao['motivoInaptidao']>;
  texto: string;
}
const falha = (
  status: Inaptidao['status'],
  motivo: Inaptidao['motivo'],
  texto: string,
): Inaptidao => ({ status, motivo, texto });

/** RN-05 a RN-09: a mesma avaliação serve à sugestão e à confirmação transacional. */
@Injectable()
export class AptidaoAlocacaoService {
  estudante(e: Estudante, unidadeId: string, especialidadeId: string): Inaptidao | null {
    if (!e || !e.ativo || e.especialidade.unidadeId !== unidadeId)
      return falha(422, 'ESPECIALIDADE_INCOMPATIVEL', 'Estudante não encontrado ou inativo.');
    if (e.especialidadeId !== especialidadeId)
      return falha(422, 'ESPECIALIDADE_INCOMPATIVEL', 'Estudante de outra especialidade.');
    if (!e.disponibilidades.length)
      return falha(409, 'FORA_DO_TURNO', 'O estudante não está disponível neste turno (RN-05).');
    if (e._count.alocacoes > 0)
      return falha(409, 'ATENDIMENTO_ATIVO', 'O estudante já está em outro atendimento (RN-05).');
    return null;
  }

  sala(s: Sala, unidadeId: string, exigidos: { recursoId: string }[]): Inaptidao | null {
    if (!s || !s.ativo || s.unidadeId !== unidadeId)
      return falha(422, 'RECURSO_INDISPONIVEL_NA_SALA', 'Sala não encontrada ou inativa.');
    const recursos = new Set(s.recursos.map((r) => r.recursoId));
    if (exigidos.some((r) => !recursos.has(r.recursoId)))
      return falha(
        422,
        'RECURSO_INDISPONIVEL_NA_SALA',
        'A sala não tem os recursos exigidos pela especialidade.',
      );
    if (s.situacao !== 'DISPONIVEL' || s._count.alocacoes > 0)
      return falha(
        409,
        s._count.alocacoes > 0 ? 'ATENDIMENTO_ATIVO' : 'RECURSO_INDISPONIVEL_NA_SALA',
        'A sala não está disponível agora (RN-09).',
      );
    return null;
  }

  supervisor(s: Supervisor, especialidadeId: string, limiteDaUnidade: number): Inaptidao | null {
    if (!s || !s.ativo) return falha(422, 'ESPECIALIDADE_INCOMPATIVEL', 'Supervisor inativo.');
    if (!s.especialidades.some((e) => e.especialidadeId === especialidadeId))
      return falha(
        422,
        'ESPECIALIDADE_INCOMPATIVEL',
        'Supervisor não habilitado nesta especialidade.',
      );
    if (!s.disponibilidades.length)
      return falha(409, 'FORA_DO_TURNO', 'O supervisor não está disponível neste turno (RN-07).');
    if (s._count.alocacoes >= (s.limiteEstudantesSimultaneos ?? limiteDaUnidade))
      return falha(
        409,
        'LIMITE_SUPERVISAO_ATINGIDO',
        `O supervisor já acompanha ${s._count.alocacoes} estudante(s), o limite dele (RN-08). Escolha outro supervisor.`,
      );
    return null;
  }
}
