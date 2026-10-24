import { StatusSenha } from '@filas/contracts';
import { describe, expect, it } from 'vitest';

import { validarAmbiente } from './ambiente';

describe('validarAmbiente', () => {
  it('usa a porta 3333 quando PORT não é informada', () => {
    const ambiente = validarAmbiente({
      DATABASE_URL: 'postgresql://filas:filas@localhost:5432/filas_dev',
    });

    expect(ambiente.PORT).toBe(3333);
  });

  it('converte PORT para número', () => {
    expect(validarAmbiente({ PORT: '4000', DATABASE_URL: 'postgresql://x' }).PORT).toBe(4000);
  });

  it('falha com mensagem legível quando falta DATABASE_URL', () => {
    expect(() => validarAmbiente({})).toThrow(/DATABASE_URL/);
  });

  it('libera web e publico no CORS por padrão e aceita lista separada por vírgula', () => {
    expect(validarAmbiente({ DATABASE_URL: 'postgresql://x' }).CORS_ORIGENS).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
    expect(
      validarAmbiente({ DATABASE_URL: 'postgresql://x', CORS_ORIGENS: ' https://a.invalid , ' })
        .CORS_ORIGENS,
    ).toEqual(['https://a.invalid']);
  });

  it('recusa LOG_LEVEL desconhecido', () => {
    expect(() => validarAmbiente({ DATABASE_URL: 'postgresql://x', LOG_LEVEL: 'tudo' })).toThrow(
      /LOG_LEVEL/,
    );
  });
});

describe('@filas/contracts', () => {
  it('é importável pela api', () => {
    expect(StatusSenha.enum.AGUARDANDO).toBe('AGUARDANDO');
  });
});
