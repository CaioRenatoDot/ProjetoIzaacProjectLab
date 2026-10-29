import { type Prisma, type StatusSenha } from '@prisma/client';

import { ErroDominio } from '../common/errors/erro-dominio';
import { type PrismaService } from '../prisma/prisma.service';

/** Senha em curso: da espera até a validação (docs/03 §5). */
const EM_CURSO: StatusSenha[] = [
  'AGUARDANDO',
  'CHAMADA',
  'AGUARDANDO_RECURSO',
  'EM_ATENDIMENTO',
  'PAUSADO',
  'PENDENTE_VALIDACAO',
];
const NUMEROS_NO_AVISO = 5;

export const mesmoConjunto = (a: readonly string[], b: readonly string[]) => {
  const conjuntoA = new Set(a);
  const conjuntoB = new Set(b);
  return conjuntoA.size === conjuntoB.size && [...conjuntoA].every((item) => conjuntoB.has(item));
};

function descrever(rotulo: string, numeros: string[], total: number): string | null {
  if (!total) return null;
  const extra = total > numeros.length ? ` e mais ${total - numeros.length}` : '';
  return `${rotulo} em uso nas senhas ${numeros.join(', ')}${extra}`;
}

/** Recursos com alocação vigente (RN-05, RN-07, RN-09): descreve as senhas, ou nulo se livre. */
export async function usoPorAlocacao(
  prisma: PrismaService,
  rotulo: string,
  filtro: Pick<Prisma.AlocacaoWhereInput, 'estudanteId' | 'supervisorId' | 'salaId'>,
): Promise<string | null> {
  const where: Prisma.AlocacaoWhereInput = { ...filtro, liberadaEm: null };
  const [alocacoes, total] = await Promise.all([
    prisma.alocacao.findMany({
      where,
      select: { senha: { select: { numero: true } } },
      orderBy: { confirmadaEm: 'asc' },
      take: NUMEROS_NO_AVISO,
    }),
    prisma.alocacao.count({ where }),
  ]);
  return descrever(
    rotulo,
    alocacoes.map((a) => a.senha.numero),
    total,
  );
}

/** Especialidade com senha em curso nas suas filas. */
export async function usoPorSenhas(
  prisma: PrismaService,
  especialidadeId: string,
): Promise<string | null> {
  const where: Prisma.SenhaWhereInput = { fila: { especialidadeId }, status: { in: EM_CURSO } };
  const [senhas, total] = await Promise.all([
    prisma.senha.findMany({
      where,
      select: { numero: true },
      orderBy: { chegadaEm: 'asc' },
      take: NUMEROS_NO_AVISO,
    }),
    prisma.senha.count({ where }),
  ]);
  return descrever(
    'Especialidade',
    senhas.map((s) => s.numero),
    total,
  );
}

/**
 * #79, T-04: mudar campo que afeta alocação em curso exige `?confirmar=true`; sem ele, 409
 * IMPACTO_EM_USO com o impacto e nada é gravado. Outros campos, ou registro sem uso, passam.
 */
export function exigirConfirmacao(
  confirmar: boolean,
  emUso: string | null,
  campos: string[],
): void {
  if (confirmar || !emUso || !campos.length) return;
  throw new ErroDominio(
    'IMPACTO_EM_USO',
    409,
    'Cadastro em uso',
    'A mudança afeta alocações em curso. Confirme para salvar.',
    { impacto: { emUso, campos } },
  );
}
