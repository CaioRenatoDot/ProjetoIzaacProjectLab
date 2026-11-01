export interface ConfigSom {
  ligado: boolean;
  volume: number;
  arquivo: string;
}
export type EstadoSom = 'inativo' | 'ativando' | 'ativo' | 'erro';
const ARQUIVO = '/sons/chamada.wav';

export function configurarSom(
  params: URLSearchParams,
  ambiente: Partial<Record<'ligado' | 'volume' | 'arquivo', string>> = {},
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
  return {
    ligado: !['false', '0', 'off'].includes(ligado.toLowerCase()),
    volume: Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 0.5,
    arquivo: local ? arquivo : ARQUIVO,
  };
}

/** Um único reprodutor e uma fila: eventos rápidos nunca se sobrepõem. */
export class SomTelao {
  private audio: HTMLAudioElement | null = null;
  private liberado = false;
  private tocando = false;
  private pendentes = 0;
  private revisao = 0;
  private encerrado = false;

  constructor(
    private config: ConfigSom,
    private estado: (estado: EstadoSom) => void,
    private criarAudio: (arquivo: string) => HTMLAudioElement = (arquivo) => new Audio(arquivo),
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
      this.pendentes = 1;
      this.proximo();
    } catch {
      this.falhou();
    }
  }

  chamada() {
    if (!this.liberado || this.encerrado) return;
    this.pendentes += 1;
    this.proximo();
  }

  private proximo = () => {
    if (!this.audio || !this.liberado || this.tocando || !this.pendentes) return;
    this.pendentes -= 1;
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
    this.pendentes = 0;
    this.audio?.pause();
    if (!this.encerrado) this.estado('inativo');
  }

  encerrar() {
    this.encerrado = true;
    this.desativar();
    this.audio?.removeEventListener('ended', this.terminou);
    this.audio?.removeEventListener('error', this.falhou);
  }
}
