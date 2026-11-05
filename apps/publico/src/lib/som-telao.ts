import { type Fala } from './fala-telao';

export interface ConfigSom {
  ligado: boolean;
  volume: number;
  arquivo: string;
  voz: boolean;
  vozRepeticoes: number;
}
export type EstadoSom = 'inativo' | 'ativando' | 'ativo' | 'erro';
const ARQUIVO = '/sons/chamada.wav';
const FRASE_DE_TESTE = 'Som ativado.';
const DESLIGADO = ['false', '0', 'off'];

export function configurarSom(
  params: URLSearchParams,
  ambiente: Partial<Record<'ligado' | 'volume' | 'arquivo' | 'voz' | 'vozRepeticoes', string>> = {},
): ConfigSom {
  const ligado = params.get('som') ?? ambiente.ligado ?? 'true';
  const valor = params.get('volume') ?? ambiente.volume ?? '0.5';
  const volume = valor.trim() === '' ? NaN : Number(valor);
  const arquivo = params.get('somArquivo') ?? ambiente.arquivo ?? ARQUIVO;
  const local =
    arquivo.startsWith('/') &&
    !arquivo.startsWith('//') &&
    !arquivo.includes('\\') &&
    new URL(arquivo, 'https://publico.invalid').origin === 'https://publico.invalid';
  const voz = params.get('voz') ?? ambiente.voz ?? 'true';
  const repeticoes = Number(params.get('vozRepeticoes') ?? ambiente.vozRepeticoes ?? '2');
  return {
    ligado: !DESLIGADO.includes(ligado.toLowerCase()),
    volume: Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 0.5,
    arquivo: local ? arquivo : ARQUIVO,
    voz: !DESLIGADO.includes(voz.toLowerCase()),
    vozRepeticoes: [1, 2, 3].includes(repeticoes) ? repeticoes : 2,
  };
}

/** Um único reprodutor e uma fila: sinal e fala de cada chamada nunca se sobrepõem. */
export class SomTelao {
  private audio: HTMLAudioElement | null = null;
  private liberado = false;
  private tocando = false;
  private pendentes: (string | undefined)[] = [];
  private frase: string | undefined;
  private revisao = 0;
  private encerrado = false;

  constructor(
    private config: Pick<ConfigSom, 'ligado' | 'volume' | 'arquivo'>,
    private estado: (estado: EstadoSom) => void,
    private criarAudio: (arquivo: string) => HTMLAudioElement = (arquivo) => new Audio(arquivo),
    private fala: Fala | null = null,
  ) {}

  ativar() {
    if (this.encerrado || !this.config.ligado || this.config.volume === 0 || this.liberado) return;
    try {
      if (!this.audio) {
        this.audio = this.criarAudio(this.config.arquivo);
        this.audio.volume = this.config.volume;
        this.audio.addEventListener('ended', this.terminou);
        this.audio.addEventListener('error', this.falhou);
      }
      this.liberado = true;
      this.estado('ativando');
      // O teste começa dentro do clique para liberar o áudio do navegador.
      this.pendentes = [FRASE_DE_TESTE];
      this.proximo();
    } catch {
      this.falhou();
    }
  }

  chamada(frase?: string) {
    if (!this.liberado || this.encerrado) return;
    this.pendentes.push(frase);
    this.proximo();
  }

  private proximo = () => {
    if (!this.audio || !this.liberado || this.tocando || !this.pendentes.length) return;
    this.frase = this.pendentes.shift();
    this.tocando = true;
    const revisao = this.revisao;
    try {
      this.audio.currentTime = 0;
      void this.audio
        .play()
        .then(() => {
          if (!this.encerrado && this.liberado && revisao === this.revisao) this.estado('ativo');
        })
        .catch(() => {
          if (revisao === this.revisao) this.falhou();
        });
    } catch {
      this.falhou();
    }
  };

  private terminou = () => {
    if (!this.tocando || !this.liberado) return;
    if (!this.frase || !this.fala) {
      this.fimDaChamada();
      return;
    }
    // O sinal já tocou: falha na fala não vira erro de som.
    try {
      this.fala.falar(this.frase, this.fimDaChamada);
    } catch {
      this.fimDaChamada();
    }
  };

  private fimDaChamada = () => {
    if (!this.tocando || !this.liberado) return;
    this.tocando = false;
    this.proximo();
  };

  private falhou = () => {
    if (this.encerrado) return;
    this.desativar();
    this.estado('erro');
  };

  desativar() {
    this.revisao += 1;
    this.liberado = false;
    this.tocando = false;
    this.pendentes = [];
    this.frase = undefined;
    this.audio?.pause();
    this.fala?.cancelar();
    if (!this.encerrado) this.estado('inativo');
  }

  encerrar() {
    this.encerrado = true;
    this.desativar();
    this.audio?.removeEventListener('ended', this.terminou);
    this.audio?.removeEventListener('error', this.falhou);
  }
}
