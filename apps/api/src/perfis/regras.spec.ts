import { describe, expect, it } from 'vitest';

import { avisosDoPerfil, mesmoConjunto } from './regras';

describe('regras de perfil (T-05)', () => {
  it('avisa quando o perfil não tem nenhuma permissão de consulta', () => {
    expect(avisosDoPerfil(['fila:chamar'])[0]?.codigo).toBe('PERFIL_SEM_CONSULTA');
    expect(avisosDoPerfil([])).toHaveLength(1);
    expect(avisosDoPerfil(['fila:consultar', 'fila:chamar'])).toEqual([]);
  });

  it('compara conjuntos de permissões sem depender da ordem', () => {
    expect(mesmoConjunto(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(mesmoConjunto(['a'], ['a', 'b'])).toBe(false);
  });
});
