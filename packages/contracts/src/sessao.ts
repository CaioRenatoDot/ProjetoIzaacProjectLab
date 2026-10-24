import { z } from 'zod';

import { Problema } from './erros';

/** Corpo de `POST /auth/login`. A identificação é comparada em minúsculas e sem espaços nas pontas. */
export const LoginEntrada = z.object({
  identificacao: z
    .string({ error: 'Informe a matrícula ou o e-mail institucional.' })
    .trim()
    .toLowerCase()
    .min(1, { error: 'Informe a matrícula ou o e-mail institucional.' }),
  // O teto evita hash de senha gigante (custo de CPU) antes de qualquer verificação.
  senha: z
    .string({ error: 'Informe a senha.' })
    .min(1, { error: 'Informe a senha.' })
    .max(128, { error: 'A senha tem no máximo 128 caracteres.' }),
  manterConectado: z.boolean().default(false),
});
export type LoginEntrada = z.infer<typeof LoginEntrada>;

/** Schema `UsuarioSessao`: a lista `permissoes` serve à interface; o servidor confere no banco. */
export const UsuarioSessao = z.object({
  id: z.string(),
  nome: z.string(),
  perfilId: z.string(),
  perfilNome: z.string(),
  unidadeId: z.string(),
  unidadeNome: z.string(),
  permissoes: z.array(z.string()),
});
export type UsuarioSessao = z.infer<typeof UsuarioSessao>;

/** Resposta de `POST /auth/login`; `expiraEm` em segundos até o access token expirar. */
export const LoginResposta = z.object({
  accessToken: z.string(),
  expiraEm: z.number().int(),
  usuario: UsuarioSessao,
});
export type LoginResposta = z.infer<typeof LoginResposta>;

/** Resposta de `POST /auth/refresh`. */
export const RenovacaoResposta = LoginResposta.pick({ accessToken: true, expiraEm: true });
export type RenovacaoResposta = z.infer<typeof RenovacaoResposta>;

/** 401 `BLOQUEIO_TEMPORARIO` do login, com o tempo que falta para liberar. */
export const ProblemaBloqueio = Problema.extend({
  minutosRestantes: z.number().int(),
});
export type ProblemaBloqueio = z.infer<typeof ProblemaBloqueio>;

/** Nome do cookie de refresh (`docs/04` §2). */
export const COOKIE_REFRESH = 'filas_refresh';
