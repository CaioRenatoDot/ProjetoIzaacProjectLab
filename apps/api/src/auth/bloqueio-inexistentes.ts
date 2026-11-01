import { BLOQUEIO_MINUTOS, TENTATIVAS_ATE_BLOQUEIO } from './sessao.constantes';

const LIMITE_ENTRADAS = 10_000;
const VALIDADE_MS = 8 * 60 * 60 * 1000;

interface Tentativas {
  falhas: number;
  bloqueadoAte: number | null;
  vistoEm: number;
}

/**
 * Imita o bloqueio para identificação que não existe. Sem isso, só contas reais bloqueariam na
 * quinta tentativa, e a diferença revelaria quais contas existem (T-01).
 * Limitação aceita: zera quando o processo reinicia e só vale com uma instância da API.
 */
export class BloqueioInexistentes {
  private readonly tentativas = new Map<string, Tentativas>();

  constructor(private readonly agora: () => number = Date.now) {}

  /** Milissegundos de bloqueio restantes, ou 0. */
  bloqueioRestante(identificacao: string): number {
    const registro = this.tentativas.get(identificacao);
    if (!registro?.bloqueadoAte) return 0;
    return Math.max(0, registro.bloqueadoAte - this.agora());
  }

  /** Conta a falha e devolve o bloqueio restante em ms (maior que 0 quando esta falha bloqueou). */
  registrarFalha(identificacao: string): number {
    const agora = this.agora();
    const anterior = this.tentativas.get(identificacao);
    const valido = anterior && agora - anterior.vistoEm < VALIDADE_MS ? anterior : undefined;
    const falhas = (valido?.falhas ?? 0) + 1;
    const bloqueia = falhas >= TENTATIVAS_ATE_BLOQUEIO;

    this.tentativas.delete(identificacao);
    this.tentativas.set(identificacao, {
      falhas: bloqueia ? 0 : falhas,
      bloqueadoAte: bloqueia ? agora + BLOQUEIO_MINUTOS * 60_000 : null,
      vistoEm: agora,
    });
    // O Map guarda a ordem de inserção: a primeira chave é a mais antiga.
    if (this.tentativas.size > LIMITE_ENTRADAS) {
      this.tentativas.delete(this.tentativas.keys().next().value!);
    }
    return bloqueia ? BLOQUEIO_MINUTOS * 60_000 : 0;
  }

  get tamanho(): number {
    return this.tentativas.size;
  }
}
