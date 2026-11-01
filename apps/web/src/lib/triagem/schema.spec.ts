import { describe, expect, it } from 'vitest';

import { errosPorCampo, FichaTriagemSchema, mascararDocumento, prioridadeEfetiva } from './schema';

const base = {
  especialidadeDestinoId: 'esp-1',
  tipoAtendimento: 'PRIMEIRA_CONSULTA',
  prioridade: 'NORMAL',
  motivo: 'Dor lombar há duas semanas',
} as const;

describe('FichaTriagemSchema', () => {
  it('RN-03: prioridade Urgente sem justificativa clínica bloqueia com mensagem no campo', () => {
    const resultado = FichaTriagemSchema.safeParse({ ...base, prioridade: 'URGENTE' });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(errosPorCampo(resultado.error).justificativaClinica).toBe(
        'Justificativa é obrigatória para prioridade Urgente.',
      );
    }
  });

  it('RN-03: Urgente com justificativa clínica é aceita', () => {
    const resultado = FichaTriagemSchema.safeParse({
      ...base,
      prioridade: 'URGENTE',
      justificativaClinica: 'Risco de agravamento',
    });
    expect(resultado.success).toBe(true);
  });

  it('RN-03: justificativa só com espaços não vale', () => {
    const resultado = FichaTriagemSchema.safeParse({
      ...base,
      prioridade: 'URGENTE',
      justificativaClinica: '   ',
    });
    expect(resultado.success).toBe(false);
  });

  it('prioridade Normal não exige justificativa clínica', () => {
    expect(FichaTriagemSchema.safeParse(base).success).toBe(true);
  });

  it('exige motivo e especialidade', () => {
    const resultado = FichaTriagemSchema.safeParse({
      ...base,
      motivo: ' ',
      especialidadeDestinoId: '',
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const erros = errosPorCampo(resultado.error);
      expect(erros.motivo).toBe('Informe o motivo do atendimento.');
      expect(erros.especialidadeDestinoId).toBe('Escolha a especialidade de destino.');
    }
  });
});

describe('prioridadeEfetiva', () => {
  it('RN-02: enquadramento legal torna Normal em Preferencial', () => {
    expect(prioridadeEfetiva('NORMAL', 'IDOSO')).toBe('PREFERENCIAL');
  });

  it('RN-02: enquadramento legal não rebaixa Urgente', () => {
    expect(prioridadeEfetiva('URGENTE', 'GESTANTE')).toBe('URGENTE');
  });

  it('sem enquadramento mantém a prioridade escolhida', () => {
    expect(prioridadeEfetiva('NORMAL', undefined)).toBe('NORMAL');
    expect(prioridadeEfetiva('PREFERENCIAL', undefined)).toBe('PREFERENCIAL');
  });
});

describe('mascararDocumento', () => {
  it('mostra só os três últimos caracteres', () => {
    expect(mascararDocumento('12345678900')).toBe('••••••••900');
  });
});
