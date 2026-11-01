import { z } from 'zod';

/** Paginação obrigatória em toda listagem (docs/04-contrato-api.md §5, RNF-03). */
export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;

const inteiro = (campo: string, minimo: number) =>
  z.coerce
    .number({ error: `Informe um número inteiro em ${campo}.` })
    .int({ error: `Informe um número inteiro em ${campo}.` })
    .min(minimo, { error: `${campo} deve ser no mínimo ${minimo}.` });

/** Query de listagem: `pagina` começa em 1; `tamanho` acima de 100 é recusado com 422, como no openapi.yaml. */
export const ParametrosPaginacao = z.object({
  pagina: inteiro('pagina', 1).default(1),
  tamanho: inteiro('tamanho', 1)
    .max(TAMANHO_PAGINA_MAXIMO, { error: `tamanho deve ser no máximo ${TAMANHO_PAGINA_MAXIMO}.` })
    .default(TAMANHO_PAGINA_PADRAO),
});
export type ParametrosPaginacao = z.infer<typeof ParametrosPaginacao>;

/** Schema `Meta` do openapi.yaml. */
export const Meta = z.object({
  pagina: z.number().int(),
  tamanho: z.number().int(),
  total: z.number().int(),
  totalPaginas: z.number().int(),
});
export type Meta = z.infer<typeof Meta>;

/** Schema `RespostaPaginada` do openapi.yaml, tipado pelo item da lista. */
export const respostaPaginada = <T extends z.ZodType>(item: T) =>
  z.object({
    dados: z.array(item),
    meta: Meta,
  });

export type RespostaPaginada<T> = { dados: T[]; meta: Meta };
