import { describe, expect, it } from 'vitest';

import { celulaCsv, linhaCsv } from './csv';

describe('CSV da trilha', () => {
  it('escapa ponto e vírgula, aspas e quebra de linha', () => {
    expect(celulaCsv('a;b')).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv('linha\nnova')).toBe('"linha\nnova"');
  });

  it('neutraliza conteúdo que viraria fórmula na planilha', () => {
    expect(celulaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celulaCsv('+5')).toBe("'+5");
    expect(celulaCsv('@SUM(1)')).toBe("'@SUM(1)");
  });

  it('monta a linha com vazio para nulo', () => {
    expect(linhaCsv(['a', null, 1, true])).toBe('a;;1;true');
  });
});
