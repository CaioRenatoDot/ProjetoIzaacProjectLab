import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarFala, textoDaChamada } from './fala-telao';

class FraseFalsa {
  voice: unknown = null;
  lang = '';
  volume = 1;
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

const voz = (lang: string, localService = true) => ({ lang, localService, name: lang });

function preparar(vozes = [voz('pt-BR')], repeticoes = 2) {
  const faladas: FraseFalsa[] = [];
  const speechSynthesis = {
    getVoices: vi.fn(() => vozes),
    speak: vi.fn((frase: FraseFalsa) => faladas.push(frase)),
    cancel: vi.fn(),
  };
  const ambiente = {
    speechSynthesis,
    SpeechSynthesisUtterance: FraseFalsa,
  } as unknown as Parameters<typeof criarFala>[1];
  const aoTerminar = vi.fn();
  return {
    fala: criarFala({ volume: 0.4, repeticoes }, ambiente)!,
    faladas,
    speechSynthesis,
    aoTerminar,
  };
}

describe('textoDaChamada (#157)', () => {
  it('fala a senha dígito a dígito, a especialidade e o local sem zero à esquerda', () => {
    expect(textoDaChamada({ numero: 'N001', especialidade: 'Nutrição', local: 'Sala 04' })).toBe(
      'Senha ene, zero, zero, um. Nutrição. Sala 4.',
    );
    expect(textoDaChamada({ numero: 'A120', especialidade: 'Fono', local: 'Sala 10' })).toBe(
      'Senha á, um, dois, zero. Fono. Sala 10.',
    );
  });
  it('sem alocação, o local é o nome da fila e a especialidade é falada uma vez', () => {
    expect(textoDaChamada({ numero: 'O002', especialidade: 'Nutrição', local: 'nutrição ' })).toBe(
      'Senha ó, zero, zero, dois. Nutrição.',
    );
  });
});

describe('criarFala (#157)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem Web Speech API não há fala', () => {
    expect(
      criarFala({ volume: 1, repeticoes: 2 }, {} as Parameters<typeof criarFala>[1]),
    ).toBeNull();
  });

  it('escolhe a voz local em pt-BR e repete a frase antes de terminar', () => {
    const remota = voz('pt-BR', false);
    const local = voz('pt_BR');
    const f = preparar([voz('en-US'), voz('pt-PT'), remota, local]);
    f.fala.falar('Senha', f.aoTerminar);
    expect(f.faladas[0]).toMatchObject({ text: 'Senha', voice: local, lang: 'pt_BR', volume: 0.4 });

    f.faladas[0]!.onend!();
    expect(f.speechSynthesis.speak).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(500);
    expect(f.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    expect(f.aoTerminar).not.toHaveBeenCalled();

    f.faladas[1]!.onend!();
    expect(f.aoTerminar).toHaveBeenCalledOnce();
  });

  it('aceita outro português; sem português não fala e a fila segue', () => {
    const portugal = preparar([voz('en-US'), voz('pt-PT')], 1);
    portugal.fala.falar('Senha', portugal.aoTerminar);
    expect(portugal.faladas[0]?.lang).toBe('pt-PT');

    const ingles = preparar([voz('en-US')]);
    ingles.fala.falar('Senha', ingles.aoTerminar);
    expect(ingles.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(ingles.aoTerminar).toHaveBeenCalledOnce();
  });

  it('erro na fala e falta do onend não travam a fila, e o fim conta uma vez só', () => {
    const f = preparar(undefined, 2);
    f.fala.falar('Senha', f.aoTerminar);
    f.faladas[0]!.onerror!();
    f.faladas[0]!.onend!();
    vi.advanceTimersByTime(500);
    expect(f.speechSynthesis.speak).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(15_000);
    expect(f.speechSynthesis.cancel).toHaveBeenCalledOnce();
    expect(f.aoTerminar).toHaveBeenCalledOnce();
    f.faladas[1]!.onend!();
    expect(f.aoTerminar).toHaveBeenCalledOnce();
  });

  it('cancelar interrompe as repetições e não avisa o fim', () => {
    const f = preparar();
    f.fala.falar('Senha', f.aoTerminar);
    f.faladas[0]!.onend!();
    f.fala.cancelar();
    vi.advanceTimersByTime(20_000);
    expect(f.speechSynthesis.speak).toHaveBeenCalledOnce();
    expect(f.speechSynthesis.cancel).toHaveBeenCalledOnce();
    expect(f.aoTerminar).not.toHaveBeenCalled();
  });
});
