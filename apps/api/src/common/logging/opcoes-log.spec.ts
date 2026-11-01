import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { CENSURA_LOG, opcoesLog } from './opcoes-log';

describe('opcoesLog', () => {
  it('censura authorization, cookie e set-cookie', () => {
    const linhas: string[] = [];
    const destino = new Writable({
      write(pedaco: Buffer, _codificacao, pronto) {
        linhas.push(pedaco.toString());
        pronto();
      },
    });
    const { redact, level } = opcoesLog('info');
    const logger = pino({ redact, level }, destino);

    logger.info({
      req: { headers: { authorization: 'Bearer token-ficticio', cookie: 'refresh=abc' } },
      res: { headers: { 'set-cookie': 'refresh=def' } },
    });

    const linha = linhas.join('');
    expect(linha).not.toContain('token-ficticio');
    expect(linha).not.toContain('refresh=abc');
    expect(linha).not.toContain('refresh=def');
    const registro = JSON.parse(linha) as { req: { headers: { authorization: string } } };
    expect(registro.req.headers.authorization).toBe(CENSURA_LOG);
  });

  it('usa o X-Request-Id como id da requisição no log', () => {
    const { genReqId } = opcoesLog('info');
    const req = { headers: { 'x-request-id': 'req-123' } };

    expect(genReqId?.(req as never, {} as never)).toBe('req-123');
  });
});
