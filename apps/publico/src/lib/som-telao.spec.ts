import { describe, expect, it, vi } from 'vitest';
import { configurarSom, SomTelao } from './som-telao';

function preparar(ligado = true, volume = 0.5) {
  const audio = new EventTarget() as HTMLAudioElement;
  const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  audio.play = play;
  const pause = vi.fn();
  audio.pause = pause;
  const criar = vi.fn(() => audio);
  const estado = vi.fn();
  const som = new SomTelao({ ligado, volume, arquivo: '/sons/chamada.wav' }, estado, criar);
  return { audio, play, pause, criar, estado, som };
}
const resolver = () => Promise.resolve();

describe('RNF-06: sinal sonoro configurável', () => {
  it('URL prevalece sobre ambiente; volume e arquivo são configuráveis', () => {
    expect(
      configurarSom(new URLSearchParams('som=0&volume=0.2&somArquivo=/sons/outro.wav'), {
        ligado: 'true',
        volume: '0.8',
        arquivo: '/sons/base.wav',
      }),
    ).toMatchObject({ ligado: false, volume: 0.2, arquivo: '/sons/outro.wav' });
    expect(configurarSom(new URLSearchParams(), { ligado: 'false', volume: '0.7' })).toMatchObject({
      ligado: false,
      volume: 0.7,
    });
  });
  it('#157: voz ligada com 2 repetições por padrão; URL prevalece sobre ambiente', () => {
    expect(configurarSom(new URLSearchParams())).toMatchObject({ voz: true, vozRepeticoes: 2 });
    expect(
      configurarSom(new URLSearchParams('voz=off&vozRepeticoes=1'), {
        voz: 'true',
        vozRepeticoes: '3',
      }),
    ).toMatchObject({ voz: false, vozRepeticoes: 1 });
    expect(configurarSom(new URLSearchParams('vozRepeticoes=9')).vozRepeticoes).toBe(2);
  });
  it.each(['-1', '2', '', 'NaN'])('volume inválido %s usa o padrão', (volume) => {
    expect(configurarSom(new URLSearchParams({ volume })).volume).toBe(0.5);
  });
  it('arquivo externo não substitui o sinal local', () => {
    expect(
      configurarSom(new URLSearchParams({ somArquivo: '//externo.test/som.wav' })).arquivo,
    ).toBe('/sons/chamada.wav');
  });
  it('não toca antes do gesto; chamada e rechamada tocam uma vez cada', async () => {
    const f = preparar();
    f.som.chamada();
    expect(f.criar).not.toHaveBeenCalled();
    f.som.ativar();
    await resolver();
    expect(f.play).toHaveBeenCalledTimes(1); // teste explícito ao ativar
    expect(f.audio.volume).toBe(0.5);
    f.audio.dispatchEvent(new Event('ended'));
    f.som.chamada();
    expect(f.play).toHaveBeenCalledTimes(2);
    f.audio.dispatchEvent(new Event('ended'));
    f.som.chamada(); // rechamada
    expect(f.play).toHaveBeenCalledTimes(3);
    f.som.encerrar();
  });
  it.each([
    [false, 0.5],
    [true, 0],
  ] as const)('som desligado ou volume zero não cria reprodutor (%s, %s)', (ligado, volume) => {
    const f = preparar(ligado, volume);
    f.som.ativar();
    f.som.chamada();
    expect(f.criar).not.toHaveBeenCalled();
  });
  it('chamadas rápidas aguardam ended sem sobrepor; desativar descarta a fila', () => {
    const f = preparar();
    f.som.ativar();
    f.som.chamada();
    f.som.chamada();
    expect(f.play).toHaveBeenCalledTimes(1);
    f.audio.dispatchEvent(new Event('ended'));
    expect(f.play).toHaveBeenCalledTimes(2);
    f.audio.dispatchEvent(new Event('ended'));
    expect(f.play).toHaveBeenCalledTimes(3);
    f.som.chamada();
    f.som.desativar();
    f.audio.dispatchEvent(new Event('ended'));
    expect(f.play).toHaveBeenCalledTimes(3);
    expect(f.pause).toHaveBeenCalledOnce();
  });
  it('bloqueio do navegador permite tentar novamente, sem rejeição não tratada', async () => {
    const f = preparar();
    vi.mocked(f.play).mockRejectedValueOnce(new DOMException('Bloqueado', 'NotAllowedError'));
    f.som.ativar();
    await resolver();
    await resolver();
    expect(f.estado).toHaveBeenLastCalledWith('erro');
    f.som.ativar();
    await resolver();
    expect(f.estado).toHaveBeenLastCalledWith('ativo');
    f.som.encerrar();
  });
  it('erro do arquivo e desmontagem param a reprodução e limpam a fila', () => {
    const f = preparar();
    f.som.ativar();
    f.audio.dispatchEvent(new Event('error'));
    expect(f.estado).toHaveBeenLastCalledWith('erro');
    f.som.ativar();
    f.som.chamada();
    f.som.encerrar();
    const chamadas = vi.mocked(f.play).mock.calls.length;
    f.audio.dispatchEvent(new Event('ended'));
    f.som.chamada();
    expect(f.play).toHaveBeenCalledTimes(chamadas);
  });
  describe('#157: fala depois do sinal', () => {
    function comFala() {
      const audio = new EventTarget() as HTMLAudioElement;
      const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      audio.play = play;
      audio.pause = vi.fn();
      const fala = { falar: vi.fn<(texto: string, fim: () => void) => void>(), cancelar: vi.fn() };
      const som = new SomTelao(
        { ligado: true, volume: 0.5, arquivo: '/sons/chamada.wav' },
        vi.fn(),
        () => audio,
        fala,
      );
      const fimDaFala = () => fala.falar.mock.lastCall![1]();
      return { audio, play, fala, som, fimDaFala };
    }

    it('ativar testa o sinal e a voz; a próxima chamada espera a fala terminar', () => {
      const f = comFala();
      f.som.ativar();
      expect(f.fala.falar).not.toHaveBeenCalled();
      f.audio.dispatchEvent(new Event('ended'));
      expect(f.fala.falar.mock.lastCall![0]).toBe('Som ativado.');

      f.som.chamada('Senha um.');
      f.som.chamada('Senha dois.');
      expect(f.play).toHaveBeenCalledOnce();
      f.fimDaFala();
      expect(f.play).toHaveBeenCalledTimes(2);
      expect(f.fala.falar).toHaveBeenCalledOnce();

      f.audio.dispatchEvent(new Event('ended'));
      expect(f.fala.falar.mock.lastCall![0]).toBe('Senha um.');
      f.fimDaFala();
      f.audio.dispatchEvent(new Event('ended'));
      expect(f.fala.falar.mock.lastCall![0]).toBe('Senha dois.');
      expect(f.play).toHaveBeenCalledTimes(3);
    });

    it('desativar cancela a fala e descarta a fila; fim atrasado não toca nada', () => {
      const f = comFala();
      f.som.ativar();
      f.audio.dispatchEvent(new Event('ended'));
      f.som.chamada('Senha um.');
      const fimAtrasado = f.fala.falar.mock.lastCall![1];
      f.som.desativar();
      expect(f.fala.cancelar).toHaveBeenCalledOnce();
      fimAtrasado();
      expect(f.play).toHaveBeenCalledOnce();
    });

    it('exceção na fala não vira erro de som e a fila segue', () => {
      const f = comFala();
      f.fala.falar.mockImplementationOnce(() => {
        throw new Error('sem voz');
      });
      f.som.ativar();
      f.som.chamada('Senha um.');
      f.audio.dispatchEvent(new Event('ended'));
      expect(f.play).toHaveBeenCalledTimes(2);
    });
  });
  it('resolução atrasada de play não reativa som desativado', async () => {
    const f = preparar();
    let concluir!: () => void;
    vi.mocked(f.play).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        concluir = resolve;
      }),
    );
    f.som.ativar();
    f.som.desativar();
    concluir();
    await resolver();
    expect(f.estado).toHaveBeenLastCalledWith('inativo');
  });
});
