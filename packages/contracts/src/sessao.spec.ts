import { describe, expect, it } from 'vitest';

import { LoginEntrada, ProblemaBloqueio } from './index';

describe('sessão', () => {
  it('normaliza a identificação e assume manterConectado falso', () => {
    expect(LoginEntrada.parse({ identificacao: '  Admin@Clinica.Invalid ', senha: 'x' })).toEqual({
      identificacao: 'admin@clinica.invalid',
      senha: 'x',
      manterConectado: false,
    });
  });

  it('recusa senha vazia e senha acima de 128 caracteres', () => {
    expect(LoginEntrada.safeParse({ identificacao: 'a', senha: '' }).success).toBe(false);
    expect(LoginEntrada.safeParse({ identificacao: 'a', senha: 'x'.repeat(129) }).success).toBe(
      false,
    );
  });

  it('recusa identificação só com espaços', () => {
    const resultado = LoginEntrada.safeParse({ identificacao: '   ', senha: 'x' });

    expect(resultado.error?.issues[0]?.message).toBe(
      'Informe a matrícula ou o e-mail institucional.',
    );
  });

  it('o bloqueio traz os minutos restantes', () => {
    const corpo = {
      type: 'about:blank',
      title: 'Acesso bloqueado temporariamente',
      status: 401,
      codigo: 'BLOQUEIO_TEMPORARIO',
      minutosRestantes: 12,
    };

    expect(ProblemaBloqueio.parse(corpo).minutosRestantes).toBe(12);
  });
});
