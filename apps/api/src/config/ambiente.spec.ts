import { StatusSenha } from '@filas/contracts';
import { describe, expect, it } from 'vitest';

import { validarAmbiente } from './ambiente';

const BASE = {
  DATABASE_URL: 'postgresql://filas:filas@localhost:5432/filas_dev',
  JWT_SEGREDO: 'segredo-ficticio-de-teste-com-32-caracteres!',
};

describe('validarAmbiente', () => {
  it('usa a porta 3333 quando PORT não é informada', () => {
    expect(validarAmbiente(BASE).PORT).toBe(3333);
  });

  it('converte PORT para número', () => {
    expect(validarAmbiente({ ...BASE, PORT: '4000' }).PORT).toBe(4000);
  });

  it('falha com mensagem legível quando falta DATABASE_URL', () => {
    expect(() => validarAmbiente({})).toThrow(/DATABASE_URL/);
  });

  it('exige JWT_SEGREDO com pelo menos 32 caracteres', () => {
    expect(() => validarAmbiente({ ...BASE, JWT_SEGREDO: undefined })).toThrow(/JWT_SEGREDO/);
    expect(() => validarAmbiente({ ...BASE, JWT_SEGREDO: 'curto' })).toThrow(/32 caracteres/);
  });

  it('libera web e publico no CORS por padrão e aceita lista separada por vírgula', () => {
    expect(validarAmbiente(BASE).CORS_ORIGENS).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
    expect(
      validarAmbiente({ ...BASE, CORS_ORIGENS: ' https://a.invalid , ' }).CORS_ORIGENS,
    ).toEqual(['https://a.invalid']);
  });

  it('recusa LOG_LEVEL desconhecido', () => {
    expect(() => validarAmbiente({ ...BASE, LOG_LEVEL: 'tudo' })).toThrow(/LOG_LEVEL/);
  });
});

describe('@filas/contracts', () => {
  it('é importável pela api', () => {
    expect(StatusSenha.enum.AGUARDANDO).toBe('AGUARDANDO');
  });
});
