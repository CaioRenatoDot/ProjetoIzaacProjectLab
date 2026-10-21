import { describe, expect, it } from 'vitest';

import { modulosVisiveis } from './modulos';

const rotulos = (permissoes: string[]) => modulosVisiveis(permissoes).map((m) => m.rotulo);

describe('modulosVisiveis', () => {
  it('omite Auditoria sem auditoria:consultar', () => {
    expect(rotulos(['fila:consultar', 'auditoria:exportar'])).not.toContain('Auditoria');
  });

  it('mostra só Cadastros para um perfil novo com permissões apenas de cadastro', () => {
    expect(rotulos(['cadastros:consultar', 'cadastros:criar', 'cadastros:editar'])).toEqual([
      'Cadastros',
    ]);
  });

  it('não mostra nada para uma sessão sem permissões', () => {
    expect(rotulos([])).toEqual([]);
  });

  it('mostra Chamada apenas com fila:chamar', () => {
    expect(rotulos(['fila:consultar'])).toEqual(['Fila']);
    expect(rotulos(['fila:consultar', 'fila:chamar'])).toEqual(['Fila', 'Chamada']);
  });
});
