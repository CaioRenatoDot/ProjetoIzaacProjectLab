import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { EncaminhamentoEntrada } from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { EncaminhamentosService } from './encaminhamentos.service';

@Controller('atendimentos/:id/encaminhamentos')
export class EncaminhamentosController {
  constructor(private readonly service: EncaminhamentosService) {}

  @Post()
  @Requer('encaminhamento:criar')
  @Auditar({ entidade: 'encaminhamento', naTransacao: true })
  registrar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(EncaminhamentoEntrada)) entrada: EncaminhamentoEntrada,
    @Req() req: Request & { usuario: UsuarioAutenticado },
  ) {
    return this.service.registrar(id, entrada, {
      usuario: req.usuario,
      origemIp: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
