import { describe, expect, it } from 'vitest';

import { BloqueioInexistentes } from './bloqueio-inexistentes';

describe('BloqueioInexistentes (T-01)', () => {
  it('bloqueia na quinta falha, como uma conta real', () => {
    let agora = 1_000_000;
    const bloqueio = new BloqueioInexistentes(() => agora);

    for (let i = 0; i < 4; i++) expect(bloqueio.registrarFalha('x')).toBe(0);
    expect(bloqueio.registrarFalha('x')).toBe(15 * 60_000);
    expect(bloqueio.bloqueioRestante('x')).toBe(15 * 60_000);

    agora += 15 * 60_000;
    expect(bloqueio.bloqueioRestante('x')).toBe(0);
  });

  it('não cresce além de 10 000 identificações', () => {
    const bloqueio = new BloqueioInexistentes();

    for (let i = 0; i <= 10_000; i++) bloqueio.registrarFalha(`id-${i}`);

    expect(bloqueio.tamanho).toBe(10_000);
  });
});
