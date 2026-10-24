/** Regras de sessão e bloqueio (docs/04 §2, T-01). */
export const ACESSO_MINUTOS = 15;
export const SESSAO_HORAS = 8;
export const TENTATIVAS_ATE_BLOQUEIO = 5;
export const BLOQUEIO_MINUTOS = 15;
/** Duas abas renovando juntas: o refresh anterior ainda vale por esse tempo, sem revogar a sessão. */
export const JANELA_ROTACAO_SEGUNDOS = 30;

/** Caminho do cookie de refresh: o navegador só o envia para `/api/v1/auth/*`. */
export const CAMINHO_COOKIE_REFRESH = '/api/v1/auth';

export const EMISSOR_TOKEN = 'filas-api';
export const AUDIENCIA_TOKEN = 'filas';
