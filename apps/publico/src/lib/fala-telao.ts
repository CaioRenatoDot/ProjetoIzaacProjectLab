export interface Fala {
  /** `aoTerminar` sempre é chamado, salvo se a fala for cancelada: a fila do telão não trava. */
  falar: (texto: string, aoTerminar: () => void) => void;
  cancelar: () => void;
}

const LETRAS: Record<string, string> = {
  A: 'á',
  B: 'bê',
  C: 'cê',
  D: 'dê',
  E: 'é',
  F: 'efe',
  G: 'gê',
  H: 'agá',
  I: 'i',
  J: 'jota',
  K: 'cá',
  L: 'ele',
  M: 'eme',
  N: 'ene',
  O: 'ó',
  P: 'pê',
  Q: 'quê',
  R: 'erre',
  S: 'esse',
  T: 'tê',
  U: 'u',
  V: 'vê',
  W: 'dáblio',
  X: 'xis',
  Y: 'ípsilon',
  Z: 'zê',
};
const DIGITOS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const LIMITE_POR_FRASE_MS = 15_000;
const PAUSA_ENTRE_REPETICOES_MS = 500;

/** Só senha, especialidade e local, os mesmos dados da tela (P-03, RNF-02). */
export function textoDaChamada(chamada: { numero: string; especialidade: string; local: string }) {
  const senha = [...chamada.numero]
    .map((c) => (/\d/.test(c) ? DIGITOS[Number(c)] : (LETRAS[c.toUpperCase()] ?? c)))
    .join(', ');
  // Sem alocação, o local é o nome da fila: não fala a especialidade duas vezes.
  const repetido =
    chamada.local.trim().toLocaleLowerCase('pt-BR') ===
    chamada.especialidade.trim().toLocaleLowerCase('pt-BR');
  const local = repetido ? '' : ` ${chamada.local.trim().replace(/\b0+(\d)/g, '$1')}.`;
  return `Senha ${senha}. ${chamada.especialidade.trim()}.${local}`;
}

const idioma = (voz: SpeechSynthesisVoice) => voz.lang.replace('_', '-').toLowerCase();

/** A voz local não depende de internet; sem português, nada de voz estrangeira lendo a frase. */
function vozEmPortugues(vozes: SpeechSynthesisVoice[]) {
  const brasil = vozes.filter((voz) => idioma(voz) === 'pt-br');
  return (
    brasil.find((voz) => voz.localService) ??
    brasil[0] ??
    vozes.find((voz) => idioma(voz).startsWith('pt'))
  );
}

/** Voz do navegador (Web Speech API). Sem suporte, devolve `null` e o telão toca só o sinal. */
export function criarFala(
  { volume, repeticoes }: { volume: number; repeticoes: number },
  ambiente: Pick<typeof globalThis, 'speechSynthesis' | 'SpeechSynthesisUtterance'> = globalThis,
): Fala | null {
  const sintese = ambiente.speechSynthesis;
  const Frase = ambiente.SpeechSynthesisUtterance;
  if (!sintese || !Frase) return null;
  let revisao = 0;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  // O Chrome carrega as vozes depois da primeira leitura.
  sintese.getVoices();

  return {
    falar(texto, aoTerminar) {
      const voz = vozEmPortugues(sintese.getVoices());
      if (!voz) {
        aoTerminar();
        return;
      }
      revisao += 1;
      const atual = revisao;
      let restantes = repeticoes;
      const proxima = () => {
        if (atual !== revisao) return;
        if (restantes === 0) {
          aoTerminar();
          return;
        }
        restantes -= 1;
        let concluida = false;
        const concluir = () => {
          if (concluida) return;
          concluida = true;
          clearTimeout(temporizador);
          if (restantes === 0) proxima();
          else temporizador = setTimeout(proxima, PAUSA_ENTRE_REPETICOES_MS);
        };
        const frase = new Frase(texto);
        frase.voice = voz;
        frase.lang = voz.lang;
        frase.volume = volume;
        frase.rate = 0.95;
        frase.onend = concluir;
        frase.onerror = concluir;
        // O `onend` do Chrome às vezes não dispara.
        temporizador = setTimeout(() => {
          sintese.cancel();
          concluir();
        }, LIMITE_POR_FRASE_MS);
        sintese.speak(frase);
      };
      proxima();
    },
    cancelar() {
      revisao += 1;
      clearTimeout(temporizador);
      sintese.cancel();
    },
  };
}
