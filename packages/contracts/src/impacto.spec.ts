import { describe, expect, it } from 'vitest';

import { CodigoErro, ConfirmarQuery, ImpactoEmUso } from './index';

describe('impacto em uso (#79)', () => {
  it('confirmar é falso por padrão e aceita true da query', () => {
    expect(ConfirmarQuery.parse({})).toEqual({ confirmar: false });
    expect(ConfirmarQuery.parse({ confirmar: 'true' })).toEqual({ confirmar: true });
  });

  it('o impacto descreve o uso e os campos', () => {
    expect(
      ImpactoEmUso.parse({ emUso: 'Estudante alocado na senha F014', campos: ['disponibilidade'] }),
    ).toBeTruthy();
    expect(CodigoErro.safeParse('IMPACTO_EM_USO').success).toBe(true);
  });
});
