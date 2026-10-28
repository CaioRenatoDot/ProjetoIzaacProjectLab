import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { type EventosFila, type EventosAlertas } from '@filas/contracts';
import { EventEmitter } from 'node:events';

/** Contexto interno de roteamento; a unidade não faz parte do corpo enviado ao cliente. */
type Eventos = EventosFila & {
  [N in keyof EventosAlertas]: { unidadeId: string; dados: EventosAlertas[N] };
};

/**
 * Barramento dos eventos de domínio (docs/04 §7). Quem grava emite **depois** do commit; o
 * gateway Socket.IO (parte 6.3) assina e repassa. Falha de um assinante não derruba a escrita.
 */
@Injectable()
export class EventosDominio {
  private readonly logger = new Logger(EventosDominio.name);
  private readonly emissor = new EventEmitter();

  emitir<N extends keyof Eventos>(nome: N, carga: Eventos[N]): void {
    for (const ouvinte of this.emissor.listeners(nome)) {
      try {
        (ouvinte as (carga: Eventos[N]) => void)(carga);
      } catch (erro) {
        this.logger.error({ err: erro, evento: nome }, 'Falha ao entregar evento de domínio');
      }
    }
  }

  assinar<N extends keyof Eventos>(
    nome: N,
    ouvinte: (carga: Eventos[N]) => void | Promise<void>,
  ): () => void {
    const receber = (carga: Eventos[N]): void => {
      const resultado = ouvinte(carga);
      if (resultado)
        void resultado.catch((erro: unknown) => {
          this.logger.error({ err: erro, evento: nome }, 'Falha ao entregar evento de domínio');
        });
    };
    this.emissor.on(nome, receber);
    return () => this.emissor.off(nome, receber);
  }
}

@Global()
@Module({ providers: [EventosDominio], exports: [EventosDominio] })
export class EventosDominioModule {}
