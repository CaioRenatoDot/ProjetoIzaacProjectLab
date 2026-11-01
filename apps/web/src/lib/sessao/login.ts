import { z } from 'zod';

import { ErroApi } from '@/lib/api/cliente-http';

/** Campos de T-01. Rótulo e obrigatoriedade conforme a especificação de UI. */
export const LoginSchema = z.object({
  identificacao: z.string().trim().min(1, 'Informe a matrícula ou o e-mail institucional.'),
  senha: z.string().min(1, 'Informe a senha.'),
  manterConectado: z.boolean(),
});
export type LoginEntrada = z.infer<typeof LoginSchema>;

/**
 * Mesma mensagem para usuário inexistente e senha incorreta (T-01, `docs/04` §2). Fica no front
 * para que nenhuma variação do servidor revele qual dos dois errou.
 */
export const MENSAGEM_CREDENCIAL_INVALIDA =
  'Identificação ou senha incorreta. Verifique os dados e tente novamente.';

export const MENSAGEM_SEM_PERFIL =
  'Sua conta ainda não tem perfil de acesso. Peça à administração da unidade para liberar o acesso.';

const MENSAGEM_BLOQUEIO_PADRAO =
  'Acesso bloqueado temporariamente por excesso de tentativas. Tente novamente mais tarde.';

const MENSAGEM_FALHA_GENERICA =
  'Não foi possível entrar agora. Tente novamente em alguns instantes.';

/** Mensagem exibida na área de erro do login para cada falha de `POST /auth/login`. */
export function mensagemErroLogin(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_FALHA_GENERICA;
  // O tempo restante do bloqueio só vem no texto de `detail` (`openapi.yaml`, exemplo "bloqueado").
  if (erro.codigo === 'BLOQUEIO_TEMPORARIO') return erro.detail || MENSAGEM_BLOQUEIO_PADRAO;
  if (erro.status === 401) return MENSAGEM_CREDENCIAL_INVALIDA;
  if (erro.status === 403) return MENSAGEM_SEM_PERFIL;
  if (erro.codigo === 'REDE') return erro.detail;
  return MENSAGEM_FALHA_GENERICA;
}
