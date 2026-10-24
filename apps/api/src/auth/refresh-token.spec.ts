import { describe, expect, it } from 'vitest';

import { gerarSegredo, hashSegredo, lerRefresh, montarRefresh } from './refresh-token';

const SESSAO = '0190a000-0000-7000-8000-000000000001';

describe('refresh token', () => {
  it('monta e lê o formato sessaoId.segredo', () => {
    const segredo = gerarSegredo();

    expect(lerRefresh(montarRefresh({ sessaoId: SESSAO, segredo }))).toEqual({
      sessaoId: SESSAO,
      segredo,
    });
  });

  it.each([undefined, '', 'abc', `${SESSAO}.curto`, `nao-uuid.${'a'.repeat(43)}`, 42])(
    'recusa %o sem consultar o banco',
    (valor) => {
      expect(lerRefresh(valor)).toBeNull();
    },
  );

  it('guarda só o SHA-256 do segredo', () => {
    const segredo = gerarSegredo();

    expect(hashSegredo(segredo)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSegredo(segredo)).not.toContain(segredo);
  });
});
