import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh token opaco no formato `<sessaoId>.<segredo>`. Só o SHA-256 do segredo vai para o
 * banco (`sessao.token_hash`): um vazamento da tabela não permite renovar sessões.
 */
export interface RefreshToken {
  sessaoId: string;
  segredo: string;
}

const FORMATO =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export function gerarSegredo(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSegredo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex');
}

export function montarRefresh({ sessaoId, segredo }: RefreshToken): string {
  return `${sessaoId}.${segredo}`;
}

/** Cookie ausente ou fora do formato devolve `null`, sem consultar o banco. */
export function lerRefresh(valor: unknown): RefreshToken | null {
  if (typeof valor !== 'string') return null;
  const partes = FORMATO.exec(valor);
  return partes ? { sessaoId: partes[1]!, segredo: partes[2]! } : null;
}
