import { describe, expect, it } from 'vitest';

import { AtendimentoResumo, Desfecho, EncerrarEntrada, ValidarEntrada } from './index';

describe('atendimentos', () => {
  it('RN-11 recusa exige parecer; aprovação não', () => {
    expect(ValidarEntrada.safeParse({ aprovado: false, versao: 3 }).success).toBe(false);
    expect(ValidarEntrada.safeParse({ aprovado: false, parecer: ' ', versao: 3 }).success).toBe(
      false,
    );
    expect(ValidarEntrada.safeParse({ aprovado: true, versao: 3 }).success).toBe(true);
  });

  it('desfecho ausente chega ao servidor como nulo (DESFECHO_OBRIGATORIO)', () => {
    expect(EncerrarEntrada.parse({ versao: 2 })).toEqual({ desfecho: null, versao: 2 });
    expect(EncerrarEntrada.safeParse({ desfecho: 'OBITO', versao: 2 }).success).toBe(false);
  });

  it('expõe os quatro desfechos', () => {
    expect(Desfecho.options).toHaveLength(4);
  });

  it('o resumo não traz observações nem triagem (P-03)', () => {
    for (const campo of ['observacoes', 'triagem', 'parecerSupervisor', 'pacienteNome']) {
      expect(AtendimentoResumo.shape).not.toHaveProperty(campo);
    }
  });
});
