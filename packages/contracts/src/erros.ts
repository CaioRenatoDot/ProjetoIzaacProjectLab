import { z } from 'zod';

/**
 * Códigos de erro estáveis, legíveis por máquina (docs/04-contrato-api.md §4).
 * Os técnicos valem para qualquer endpoint; os de domínio citam a regra na tabela do §4.
 */
export const CodigoErro = z.enum([
  'VALIDACAO',
  'CORPO_INVALIDO',
  'NAO_AUTENTICADO',
  'SEM_PERMISSAO',
  'NAO_ENCONTRADO',
  'ERRO_INTERNO',
  'BANCO_INDISPONIVEL',
  'CREDENCIAL_INVALIDA',
  'BLOQUEIO_TEMPORARIO',
  'DUPLICIDADE',
  'VINCULO_ATIVO',
  'TRANSICAO_INVALIDA',
  'VERSAO_DESATUALIZADA',
  'FILA_BLOQUEADA',
  'FILA_VAZIA',
  'SEM_FILA_CONFIGURADA',
  'JUSTIFICATIVA_OBRIGATORIA',
  'RECURSO_INDISPONIVEL',
  'LIMITE_SUPERVISAO_ATINGIDO',
  'SUPERVISOR_INDISPONIVEL',
  'DESFECHO_OBRIGATORIO',
  'ESPECIALIDADE_INATIVA',
  'SENHA_NAO_ENCONTRADA',
]);
export type CodigoErro = z.infer<typeof CodigoErro>;

/** RFC 7807 com o campo adicional `codigo` (schema `Problema` do openapi.yaml). */
export const Problema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  codigo: CodigoErro,
  instance: z.string().optional(),
});
export type Problema = z.infer<typeof Problema>;

/** Um item de `campos`: `campo` usa o mesmo nome do corpo enviado, para o front ligar a mensagem ao campo. */
export const CampoInvalido = z.object({
  campo: z.string(),
  mensagem: z.string(),
});
export type CampoInvalido = z.infer<typeof CampoInvalido>;

/** Erro 422 de validação (schema `ProblemaValidacao`). */
export const ProblemaValidacao = Problema.extend({
  campos: z.array(CampoInvalido),
});
export type ProblemaValidacao = z.infer<typeof ProblemaValidacao>;

/** Informação que não bloqueia a operação (schema `Aviso`), por exemplo `PACIENTE_COM_RESTRICAO`. */
export const Aviso = z.object({
  codigo: z.string(),
  mensagem: z.string(),
});
export type Aviso = z.infer<typeof Aviso>;
