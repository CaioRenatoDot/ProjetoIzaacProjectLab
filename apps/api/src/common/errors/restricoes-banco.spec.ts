import { describe, expect, it } from 'vitest';

import { campoDaRestricao } from './restricoes-banco';

const mensagem = (restricao: string) =>
  `PostgresError { code: "23514", message: "new row for relation \\"x\\" violates check constraint \\"${restricao}\\"" }`;

describe('campoDaRestricao', () => {
  it('RN-01 liga o CHECK da reclassificação ao campo justificativa', () => {
    expect(campoDaRestricao(mensagem('reclassificacao_justificativa_check'))?.campo).toBe(
      'justificativa',
    );
  });

  it('RN-03 liga o CHECK da triagem ao campo justificativaClinica', () => {
    expect(campoDaRestricao(mensagem('triagem_urgente_justificativa_check'))?.campo).toBe(
      'justificativaClinica',
    );
  });

  it('CHECK fora da lista e erro sem CHECK não viram validação', () => {
    expect(campoDaRestricao(mensagem('fila_letra_senha_check'))).toBeUndefined();
    expect(campoDaRestricao('Connection refused')).toBeUndefined();
  });
});
