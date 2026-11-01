/** Faz o papel do cookie httpOnly de refresh na simulação. Guarda só o id do usuário simulado. */
export const COOKIE_REFRESH_MOCK = 'filas-mock-refresh';

/**
 * Troca as permissões do usuário simulado (lista separada por vírgula). Usado pelos testes
 * Playwright para simular perfis diferentes. Só existe na simulação, nunca na API real.
 */
export const COOKIE_PERMISSOES_DEV = 'filas-dev-permissoes';
