import { describe, expect, it } from 'vitest';

import {
  avisoUsuariosAfetados,
  nomeDaCopia,
  semPermissaoDeConsulta,
  somenteLeitura,
  validarNome,
} from './regras';
import { type Perfil } from './tipos';

const perfil = (dados: Partial<Perfil>): Perfil => ({
  id: 'p1',
  nome: 'Recepção',
  descricao: '',
  sistema: false,
  permissoes: [],
  usuariosVinculados: 0,
  ...dados,
});

describe('avisoUsuariosAfetados', () => {
  it('avisa quantos usuários serão afetados', () => {
    expect(avisoUsuariosAfetados(3)).toBe('Esta alteração muda as permissões de 3 usuários.');
    expect(avisoUsuariosAfetados(1)).toBe('Esta alteração muda as permissões de 1 usuário.');
  });

  it('não avisa quando nenhum usuário usa o perfil', () => {
    expect(avisoUsuariosAfetados(0)).toBeNull();
  });
});

describe('somenteLeitura', () => {
  it('trata o perfil do sistema como somente leitura', () => {
    expect(somenteLeitura(perfil({ sistema: true }))).toBe(true);
    expect(somenteLeitura(perfil({ sistema: false }))).toBe(false);
  });
});

describe('semPermissaoDeConsulta', () => {
  it('detecta perfil sem nenhuma permissão de consulta', () => {
    expect(semPermissaoDeConsulta(['fila:chamar'])).toBe(true);
    expect(semPermissaoDeConsulta([])).toBe(true);
    expect(semPermissaoDeConsulta(['cadastros:consultar'])).toBe(false);
  });
});

describe('validarNome', () => {
  const perfis = [perfil({ id: 'p1', nome: 'Recepção' })];

  it('exige nome', () => {
    expect(validarNome('   ', perfis, null)).toBe('Informe o nome do perfil.');
  });

  it('recusa nome repetido, ignorando maiúsculas', () => {
    expect(validarNome('recepção', perfis, null)).toMatch(/Já existe/);
  });

  it('aceita o próprio nome ao editar', () => {
    expect(validarNome('Recepção', perfis, 'p1')).toBeNull();
  });
});

describe('nomeDaCopia', () => {
  it('gera nome único para o perfil duplicado', () => {
    const perfis = [perfil({ nome: 'Recepção' }), perfil({ id: 'p2', nome: 'Cópia de Recepção' })];
    expect(nomeDaCopia('Recepção', perfis)).toBe('Cópia de Recepção (2)');
  });
});
