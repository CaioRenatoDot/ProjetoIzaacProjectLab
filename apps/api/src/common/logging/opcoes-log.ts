import { type IncomingMessage } from 'node:http';

import { type Options } from 'pino-http';

/** Valor que substitui token, cookie e set-cookie no log. */
export const CENSURA_LOG = '[omitido]';

/**
 * Opções do pino-http: log JSON por linha, com o X-Request-Id gerado pelo middleware.
 * Token e cookies nunca vão para o log (o pino-http grava os cabeçalhos inteiros).
 * Corpo da requisição não é logado: pode ter dado pessoal ou de saúde (RNF-07).
 */
export function opcoesLog(nivel: string): Options {
  return {
    level: nivel,
    genReqId: (req: IncomingMessage) => String(req.headers['x-request-id'] ?? ''),
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: CENSURA_LOG,
    },
  };
}
