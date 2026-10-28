import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { type EventosFila, type NomeEventoFila } from '@filas/contracts';
import { EventEmitter } from 'node:events';

/**
 * Barramento dos eventos de domínio (docs/04 §7). Quem grava emite **depois** do commit; o
 * gateway Socket.IO (parte 6.3) assina e repassa. Falha de um assinante não derruba a escrita.
 */
@Injectable()
export class EventosDominio {
  private readonly logger = new Logger(EventosDominio.name);
  private readonly emissor = new EventEmitter();

  emitir<N extends NomeEventoFila>(nome: N, carga: EventosFila[N]): void {
    for (const ouvinte of this.emissor.listeners(nome)) {
      try {
        (ouvinte as (carga: EventosFila[N]) => void)(carga);
      } catch (erro) {
        this.logger.error({ err: erro, evento: nome }, 'Falha ao entregar evento de domínio');
      }
    }
  }

  assinar<N extends NomeEventoFila>(
    nome: N,
    ouvinte: (carga: EventosFila[N]) => void | Promise<void>,
  ): () => void {
    const receber = (carga: EventosFila[N]): void => {
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
