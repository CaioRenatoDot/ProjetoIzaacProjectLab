import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { Publico } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { PublicoLimiteGuard } from './publico-limite.guard';
import { PublicoService } from './publico.service';

@Controller('publico')
@Publico()
@UseGuards(PublicoLimiteGuard)
export class PublicoController {
  constructor(private readonly publico: PublicoService) {}

  @Get('painel/:unidadeId')
  estado(@Param('unidadeId', IdPipe) unidadeId: string) {
    return this.publico.estado(unidadeId);
  }

  @Get('senhas/:numero')
  consultar(@Param('numero') numero: string) {
    return this.publico.consultar(numero);
  }
}
