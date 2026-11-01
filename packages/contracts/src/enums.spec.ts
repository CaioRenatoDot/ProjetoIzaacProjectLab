import { describe, expect, it } from 'vitest';

import { EnquadramentoLegal, Prioridade, StatusSenha, TipoAtendimento, VinculoPaciente } from './index';

describe('enums do domínio', () => {
  it('StatusSenha tem os nove status da Tabela 11', () => {
    expect(StatusSenha.options).toHaveLength(9);
    expect(StatusSenha.parse('AGUARDANDO')).toBe('AGUARDANDO');
  });

  it('rejeita valor fora do enum', () => {
    expect(Prioridade.safeParse('ALTA').success).toBe(false);
    expect(TipoAtendimento.safeParse('retorno').success).toBe(false);
  });

  it('expõe os valores de EnquadramentoLegal e VinculoPaciente', () => {
    expect(EnquadramentoLegal.enum.PCD).toBe('PCD');
    expect(VinculoPaciente.options).toEqual(['EXTERNO', 'ALUNO', 'SERVIDOR']);
  });
});
