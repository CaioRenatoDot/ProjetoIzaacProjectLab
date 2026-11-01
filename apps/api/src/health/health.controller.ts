import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { type StatusSaude } from './dto/status-saude.dto';
import { Publico } from '../common/autorizacao/decorators';
import { HealthService } from './health.service';

@Controller('health')
@Publico()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: responde sem tocar no banco. */
  @Get()
  liveness(): StatusSaude {
    return { status: 'ok' };
  }

  /** Readiness: 200 se o banco responde, 503 se não. */
  @Get('ready')
  async readiness(): Promise<StatusSaude> {
    if (await this.healthService.bancoDisponivel()) {
      return { status: 'ok' };
    }
    throw new ServiceUnavailableException({
      type: 'about:blank',
      title: 'Serviço indisponível',
      status: 503,
      detail: 'O banco de dados não respondeu. Tente novamente em instantes.',
      codigo: 'BANCO_INDISPONIVEL',
    });
  }
}
