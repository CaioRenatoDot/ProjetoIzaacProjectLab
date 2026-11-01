import { describe, expect, it } from 'vitest';

import { INDICADORES, montarHome, rotuloIndicador } from './home';

const ids = (permissoes: string[]) => montarHome(permissoes).blocos.map((b) => b.id);

describe('montarHome', () => {
  it('mostra o bloco de triagem com "Nova triagem" e nenhum bloco de gestão', () => {
    const { blocos } = montarHome(['triagem:consultar', 'triagem:criar']);
    expect(blocos.map((b) => b.id)).toEqual(['triagem']);
    expect(blocos[0]?.acao?.rotulo).toBe('Nova triagem');
  });

  it('mostra a fila sem "Chamar próxima" quando falta fila:chamar', () => {
    const { blocos } = montarHome(['fila:consultar']);
    expect(blocos).toHaveLength(1);
    expect(blocos[0]?.acao).toBeUndefined();
  });

  it('monta os blocos de um perfil novo só pelas permissões', () => {
    expect(ids(['atendimento:validar', 'indicadores:consultar'])).toEqual(['supervisao', 'gestao']);
  });

  it('não mostra nada sem permissões', () => {
    expect(montarHome([])).toEqual({ blocos: [], indicadores: [] });
  });

  it('limita os cartões de indicador a 4', () => {
    const todas = INDICADORES.map((i) => i.permissao);
    expect(montarHome(todas).indicadores.length).toBeLessThanOrEqual(4);
  });
});

describe('rotuloIndicador', () => {
  const [fila] = INDICADORES;

  it('anuncia rótulo, valor e unidade', () => {
    expect(rotuloIndicador(fila!, 7)).toBe('Aguardando na fila: 7 senhas');
  });

  it('anuncia a falta de dados sem inventar valor', () => {
    expect(rotuloIndicador(fila!, null)).toBe('Aguardando na fila: sem dados no momento');
  });
});
