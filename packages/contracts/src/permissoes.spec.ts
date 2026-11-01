import { describe, expect, it } from 'vitest';

import { catalogoParaResposta, ehPermissao, PermissaoSchema, PERMISSOES } from './index';

describe('catálogo de permissões', () => {
  it('tem as 39 permissões do docs/04 §3, sem repetição', () => {
    expect(PERMISSOES).toHaveLength(39);
    expect(new Set(PERMISSOES).size).toBe(39);
  });

  it('reconhece permissões do catálogo e recusa as de fora', () => {
    expect(ehPermissao('fila:chamar')).toBe(true);
    expect(ehPermissao('fila:voar')).toBe(false);
    expect(PermissaoSchema.safeParse('cadastros:voar').success).toBe(false);
  });

  it('marca como sensíveis triagem, atendimento e auditoria (T-05)', () => {
    const sensiveis = catalogoParaResposta()
      .filter((m) => m.sensivel)
      .map((m) => m.modulo);

    expect(sensiveis).toEqual(['triagem', 'atendimento', 'auditoria']);
  });

  it('monta a resposta de GET /permissoes com a permissão completa', () => {
    const fila = catalogoParaResposta().find((m) => m.modulo === 'fila');

    expect(fila?.operacoes).toContainEqual({ operacao: 'chamar', permissao: 'fila:chamar' });
  });
});
