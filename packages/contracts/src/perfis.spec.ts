import { describe, expect, it } from 'vitest';

import { ListarUsuariosQuery, PerfilEntrada, UsuarioAlteracao, UsuarioEntrada } from './index';

const PERFIL = '0190a000-0000-7000-8000-000000000001';

describe('perfis e usuários', () => {
  it('PerfilEntrada remove permissões repetidas e recusa as de fora do catálogo', () => {
    expect(
      PerfilEntrada.parse({ nome: ' Recepção ', permissoes: ['fila:chamar', 'fila:chamar'] }),
    ).toEqual({ nome: 'Recepção', permissoes: ['fila:chamar'] });
    expect(PerfilEntrada.safeParse({ nome: 'x', permissoes: ['fila:voar'] }).success).toBe(false);
  });

  it('PerfilEntrada ignora sistema no corpo', () => {
    expect(PerfilEntrada.parse({ nome: 'x', permissoes: [], sistema: true })).not.toHaveProperty(
      'sistema',
    );
  });

  it('UsuarioEntrada normaliza a identificação e exige senha de 8 a 128', () => {
    const entrada = {
      nome: 'Usuario',
      identificacao: ' Pessoa@Clinica.Invalid ',
      senhaInicial: '12345678',
      perfilId: PERFIL,
    };

    expect(UsuarioEntrada.parse(entrada).identificacao).toBe('pessoa@clinica.invalid');
    expect(UsuarioEntrada.safeParse({ ...entrada, senhaInicial: 'curta' }).success).toBe(false);
  });

  it('UsuarioAlteracao exige ao menos um campo e só aceita desbloquear: true', () => {
    expect(UsuarioAlteracao.safeParse({}).success).toBe(false);
    expect(UsuarioAlteracao.safeParse({ desbloquear: false }).success).toBe(false);
    expect(UsuarioAlteracao.safeParse({ desbloquear: true }).success).toBe(true);
  });

  it('ListarUsuariosQuery converte ativo e recusa valor inválido', () => {
    expect(ListarUsuariosQuery.parse({ ativo: 'false' }).ativo).toBe(false);
    expect(ListarUsuariosQuery.safeParse({ ativo: 'talvez' }).success).toBe(false);
  });
});
