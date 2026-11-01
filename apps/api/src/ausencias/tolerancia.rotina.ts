import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AusenciasService } from './ausencias.service';

/** Varredura da tolerância (RN-12) a cada minuto (docs/01 §2, @nestjs/schedule). */
@Injectable()
export class ToleranciaRotina {
  private readonly logger = new Logger(ToleranciaRotina.name);

  constructor(private readonly ausencias: AusenciasService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'tolerancia' })
  async executar(): Promise<void> {
    try {
      const tratadas = await this.ausencias.processarToleranciasVencidas();
      if (tratadas) this.logger.log({ tratadas }, 'Tolerâncias vencidas tratadas');
    } catch (erro) {
      this.logger.error({ err: erro }, 'Falha na rotina de tolerância');
    }
  }
}
