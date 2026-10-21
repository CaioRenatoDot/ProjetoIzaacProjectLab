import { describe, expect, it } from 'vitest';

import { destinoSeguro, urlLogin } from './destino';

describe('destinoSeguro', () => {
  it.each(['/triagem', '/acesso/perfis?aba=1', '/'])('aceita caminho interno %s', (rota) => {
    expect(destinoSeguro(rota)).toBe(rota);
  });

  it.each([
    'https://exemplo.com',
    '//exemplo.com',
    '/\\exemplo.com',
    'javascript:alert(1)',
    'triagem',
    '',
    undefined,
    null,
  ])('recusa %s (redirecionamento aberto) e vai para a home', (valor) => {
    expect(destinoSeguro(valor)).toBe('/');
  });

  it('não volta para o próprio login', () => {
    expect(destinoSeguro('/login?redirect=/triagem')).toBe('/');
  });
});

describe('urlLogin', () => {
  it('guarda a rota de destino', () => {
    expect(urlLogin('/triagem?etapa=2')).toBe('/login?redirect=%2Ftriagem%3Fetapa%3D2');
  });

  it('marca a sessão expirada', () => {
    expect(urlLogin('/triagem', true)).toBe('/login?redirect=%2Ftriagem&expirada=1');
  });

  it('sem destino útil, vai só para /login', () => {
    expect(urlLogin('/')).toBe('/login');
    expect(urlLogin('//exemplo.com')).toBe('/login');
  });
});
