import { type ParametrosPaginacao, type RespostaPaginada } from '@filas/contracts';

/** `skip`/`take` do Prisma a partir de `pagina` e `tamanho` já validados. */
export function deslocamento({ pagina, tamanho }: ParametrosPaginacao): {
  skip: number;
  take: number;
} {
  return { skip: (pagina - 1) * tamanho, take: tamanho };
}

/** Monta `{ dados, meta }` (schema `RespostaPaginada`, docs/04 §5). */
export function montarRespostaPaginada<T>(
  dados: T[],
  total: number,
  { pagina, tamanho }: ParametrosPaginacao,
): RespostaPaginada<T> {
  return {
    dados,
    meta: { pagina, tamanho, total, totalPaginas: Math.ceil(total / tamanho) },
  };
}
