import { Injectable, Logger } from '@nestjs/common';

import { HealthRepository } from './health.repository';

/** Limite para o banco responder antes de o readiness considerá-lo indisponível. */
export const TIMEOUT_PING_BANCO_MS = 3000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly repository: HealthRepository) {}

  async bancoDisponivel(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolver, rejeitar) => {
      timer = setTimeout(
        () => rejeitar(new Error(`sem resposta em ${TIMEOUT_PING_BANCO_MS} ms`)),
        TIMEOUT_PING_BANCO_MS,
      );
    });

    try {
      await Promise.race([this.repository.pingBanco(), timeout]);
      return true;
    } catch (erro) {
      this.logger.warn(`Readiness: banco indisponível (${(erro as Error).message})`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
