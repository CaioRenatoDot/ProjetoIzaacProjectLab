import { z } from 'zod';

import { Aviso } from './erros';
import { ParametrosPaginacao } from './paginacao';
import { PermissaoSchema } from './permissoes';

const uuid = (mensagem: string) => z.uuid({ error: mensagem });

/** Corpo de `POST` e `PUT /perfis`; `sistema` não é aceito (perfil da API nunca é do sistema). */
export const PerfilEntrada = z.object({
  nome: z
    .string({ error: 'Informe o nome do perfil.' })
    .trim()
    .min(1, { error: 'Informe o nome do perfil.' })
    .max(60, { error: 'O nome tem no máximo 60 caracteres.' }),
  descricao: z
    .string()
    .trim()
    .max(200, { error: 'A descrição tem no máximo 200 caracteres.' })
    .optional(),
  permissoes: z
    .array(PermissaoSchema, { error: 'Informe a lista de permissões.' })
    .transform((lista) => [...new Set(lista)]),
});
export type PerfilEntrada = z.infer<typeof PerfilEntrada>;

/** Schema `Perfil` do openapi.yaml. */
export const Perfil = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string(),
  sistema: z.boolean(),
  permissoes: z.array(z.string()),
  usuariosVinculados: z.number().int(),
  avisos: z.array(Aviso),
});
export type Perfil = z.infer<typeof Perfil>;

/** Resposta de `PUT /perfis/{id}`. */
export const PerfilAtualizado = Perfil.extend({ usuariosAfetados: z.number().int() });
export type PerfilAtualizado = z.infer<typeof PerfilAtualizado>;

export const ListarPerfisQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
});
export type ListarPerfisQuery = z.infer<typeof ListarPerfisQuery>;

/** Schema `Usuario` do openapi.yaml (nunca traz senha nem hash). */
export const Usuario = z.object({
  id: z.string(),
  nome: z.string(),
  identificacao: z.string(),
  perfilId: z.string(),
  perfilNome: z.string(),
  ativo: z.boolean(),
  ultimoLoginEm: z.string().nullable(),
  bloqueadoAte: z.string().nullable(),
});
export type Usuario = z.infer<typeof Usuario>;

const nomeUsuario = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .min(1, { error: 'Informe o nome.' })
  .max(120, { error: 'O nome tem no máximo 120 caracteres.' });

const senha = z
  .string({ error: 'Informe a senha.' })
  .min(8, { error: 'A senha tem no mínimo 8 caracteres.' })
  .max(128, { error: 'A senha tem no máximo 128 caracteres.' });

/** Corpo de `POST /usuarios`. */
export const UsuarioEntrada = z.object({
  nome: nomeUsuario,
  identificacao: z
    .string({ error: 'Informe a matrícula ou o e-mail institucional.' })
    .trim()
    .toLowerCase()
    .min(1, { error: 'Informe a matrícula ou o e-mail institucional.' })
    .max(120, { error: 'A identificação tem no máximo 120 caracteres.' }),
  senhaInicial: senha,
  perfilId: uuid('Selecione um perfil válido.'),
  ativo: z.boolean().default(true),
});
export type UsuarioEntrada = z.infer<typeof UsuarioEntrada>;

/** Corpo de `PATCH /usuarios/{id}`: ao menos um campo. */
export const UsuarioAlteracao = z
  .object({
    nome: nomeUsuario.optional(),
    perfilId: uuid('Selecione um perfil válido.').optional(),
    ativo: z.boolean().optional(),
    novaSenha: senha.optional(),
    desbloquear: z
      .literal(true, { error: 'Use desbloquear: true para liberar o login.' })
      .optional(),
  })
  .refine((alteracao) => Object.values(alteracao).some((valor) => valor !== undefined), {
    error: 'Informe ao menos um campo para alterar.',
  });
export type UsuarioAlteracao = z.infer<typeof UsuarioAlteracao>;

const booleanoDaQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((valor) => valor === 'true');

export const ListarUsuariosQuery = ParametrosPaginacao.extend({
  busca: z.string().trim().optional(),
  perfilId: uuid('Informe um perfil válido.').optional(),
  ativo: booleanoDaQuery.optional(),
});
export type ListarUsuariosQuery = z.infer<typeof ListarUsuariosQuery>;
