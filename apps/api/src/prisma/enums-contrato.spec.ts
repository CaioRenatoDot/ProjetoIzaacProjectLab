import {
  EnquadramentoLegal,
  OperacaoAuditoria,
  Prioridade,
  StatusSenha,
  TipoAtendimento,
  Turno,
  VinculoPaciente,
} from '@filas/contracts';
import { $Enums } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('enums do Prisma iguais aos de @filas/contracts', () => {
  it.each([
    ['StatusSenha', $Enums.StatusSenha, StatusSenha.options],
    ['Prioridade', $Enums.Prioridade, Prioridade.options],
    ['TipoAtendimento', $Enums.TipoAtendimento, TipoAtendimento.options],
    ['EnquadramentoLegal', $Enums.EnquadramentoLegal, EnquadramentoLegal.options],
    ['VinculoPaciente', $Enums.VinculoPaciente, VinculoPaciente.options],
    ['Turno', $Enums.Turno, Turno.options],
    ['OperacaoAuditoria', $Enums.OperacaoAuditoria, OperacaoAuditoria.options],
  ])('%s tem os mesmos valores, na mesma ordem', (_nome, doPrisma, doContrato) => {
    expect(Object.values(doPrisma)).toEqual([...doContrato]);
  });

  it('StatusSenha tem os nove status da Tabela 11', () => {
    expect(Object.values($Enums.StatusSenha)).toHaveLength(9);
  });
});
