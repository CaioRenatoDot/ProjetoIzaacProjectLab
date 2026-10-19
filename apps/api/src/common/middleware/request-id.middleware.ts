import { randomUUID } from 'node:crypto';

import { type NextFunction, type Request, type Response } from 'express';

export const HEADER_REQUEST_ID = 'X-Request-Id';

// Aceita o id recebido só se for curto e sem caracteres especiais, para não ecoar
// conteúdo arbitrário do cliente no header da resposta.
const FORMATO_VALIDO = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Garante X-Request-Id em toda resposta (docs/04-contrato-api.md §9): reaproveita o
 * recebido na requisição ou gera um novo, e o deixa na requisição para log e auditoria.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const recebido = req.header(HEADER_REQUEST_ID);
  const requestId = recebido && FORMATO_VALIDO.test(recebido) ? recebido : randomUUID();

  req.headers[HEADER_REQUEST_ID.toLowerCase()] = requestId;
  res.setHeader(HEADER_REQUEST_ID, requestId);
  next();
}
