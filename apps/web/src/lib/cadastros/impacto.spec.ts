import { describe, expect, it } from 'vitest';

import { ErroApi } from '@/lib/api/cliente-http';

import { descricaoDoImpacto } from './impacto';

const detail = 'A mudança afeta alocações em curso. Confirme para salvar.';

describe('texto do 409 IMPACTO_EM_USO (#79)', () => {
  it('junta o uso descrito pela API e o detail', () => {
    const erro = new ErroApi(409, 'IMPACTO_EM_USO', detail, [], {
      impacto: { emUso: 'Sala em uso nas senhas N001', campos: ['situacao'] },
    });
    expect(descricaoDoImpacto(erro)).toBe(`Sala em uso nas senhas N001. ${detail}`);
  });

  it('sem impacto no corpo, usa só o detail', () => {
    expect(descricaoDoImpacto(new ErroApi(409, 'IMPACTO_EM_USO', detail))).toBe(detail);
  });
});
