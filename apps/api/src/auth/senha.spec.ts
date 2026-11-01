import { describe, expect, it } from 'vitest';

import { gerarHashSenha, senhaConfere } from './senha';

describe('senha', () => {
  it('gera hash argon2id e confere a senha certa', async () => {
    const hash = await gerarHashSenha('senha-ficticia');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await senhaConfere(hash, 'senha-ficticia')).toBe(true);
    expect(await senhaConfere(hash, 'outra')).toBe(false);
  });

  it('hash inválido conta como senha errada, sem lançar erro', async () => {
    expect(await senhaConfere('nao-e-um-hash', 'qualquer')).toBe(false);
  });
});
