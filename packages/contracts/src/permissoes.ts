import { z } from 'zod';

/**
 * Catálogo de permissões `modulo:operacao` (docs/04-contrato-api.md §3). É a única fonte da
 * lista: a API valida contra ele e o expõe em `GET /permissoes`; a matriz de W-05 o consome.
 * `sensivel` marca módulos com dado de saúde ou auditoria (T-05).
 */
export const CATALOGO_PERMISSOES = [
  {
    modulo: 'cadastros',
    rotulo: 'Cadastros',
    sensivel: false,
    operacoes: ['consultar', 'criar', 'editar', 'excluir'],
  },
  {
    modulo: 'perfis',
    rotulo: 'Perfis',
    sensivel: false,
    operacoes: ['consultar', 'criar', 'editar', 'excluir'],
  },
  {
    modulo: 'triagem',
    rotulo: 'Triagem',
    sensivel: true,
    operacoes: ['consultar', 'criar', 'editar', 'consultar_sensivel'],
  },
  {
    modulo: 'senha',
    rotulo: 'Senha',
    sensivel: false,
    operacoes: ['consultar', 'criar', 'reclassificar'],
  },
  {
    modulo: 'fila',
    rotulo: 'Fila',
    sensivel: false,
    operacoes: ['consultar', 'criar', 'editar', 'excluir', 'chamar'],
  },
  {
    modulo: 'alocacao',
    rotulo: 'Alocação',
    sensivel: false,
    operacoes: ['consultar', 'criar', 'editar'],
  },
  {
    modulo: 'atendimento',
    rotulo: 'Atendimento',
    sensivel: true,
    operacoes: ['consultar', 'criar', 'editar', 'validar', 'consultar_sensivel'],
  },
  {
    modulo: 'encaminhamento',
    rotulo: 'Encaminhamento',
    sensivel: false,
    operacoes: ['consultar', 'criar'],
  },
  { modulo: 'ausencia', rotulo: 'Ausências', sensivel: false, operacoes: ['consultar', 'criar'] },
  {
    modulo: 'indicadores',
    rotulo: 'Indicadores',
    sensivel: false,
    operacoes: ['consultar', 'exportar'],
  },
  {
    modulo: 'alertas',
    rotulo: 'Alertas',
    sensivel: false,
    operacoes: ['consultar', 'reconhecer', 'escalonar'],
  },
  {
    modulo: 'auditoria',
    rotulo: 'Auditoria',
    sensivel: true,
    operacoes: ['consultar', 'exportar'],
  },
] as const;

type ItemCatalogo = (typeof CATALOGO_PERMISSOES)[number];

/** União literal de todas as permissões, por exemplo `'fila:chamar'`. */
export type Permissao = {
  [M in ItemCatalogo as M['modulo']]: `${M['modulo']}:${M['operacoes'][number]}`;
}[ItemCatalogo['modulo']];

export const PERMISSOES: readonly Permissao[] = CATALOGO_PERMISSOES.flatMap(
  ({ modulo, operacoes }) => operacoes.map((operacao) => `${modulo}:${operacao}` as Permissao),
);

const conjunto = new Set<string>(PERMISSOES);

export function ehPermissao(valor: string): valor is Permissao {
  return conjunto.has(valor);
}

/** Schema de uma permissão do catálogo, para validar corpos (ex.: matriz de perfis). */
export const PermissaoSchema = z
  .string()
  .refine(ehPermissao, { error: 'Permissão fora do catálogo.' });

/** Item de `GET /permissoes` (openapi.yaml). */
export const ModuloCatalogo = z.object({
  modulo: z.string(),
  rotulo: z.string(),
  sensivel: z.boolean(),
  operacoes: z.array(z.object({ operacao: z.string(), permissao: z.string() })),
});
export type ModuloCatalogo = z.infer<typeof ModuloCatalogo>;

/** Resposta de `GET /permissoes`, montada a partir do catálogo. */
export function catalogoParaResposta(): ModuloCatalogo[] {
  return CATALOGO_PERMISSOES.map(({ modulo, rotulo, sensivel, operacoes }) => ({
    modulo,
    rotulo,
    sensivel,
    operacoes: operacoes.map((operacao) => ({ operacao, permissao: `${modulo}:${operacao}` })),
  }));
}
