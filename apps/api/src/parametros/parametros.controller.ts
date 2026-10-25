import { Controller, Get, Query, Req } from '@nestjs/common';
import { ConsultarParametrosQuery, type ParametrosVigentes } from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Autenticado } from '../common/autorizacao/decorators';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ParametrosService } from './parametros.service';

@Controller('parametros')
export class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  @Autenticado()
  consultar(
    @Query(new ZodValidationPipe(ConsultarParametrosQuery)) query: ConsultarParametrosQuery,
    @Req() req: Request & { usuario: UsuarioAutenticado },
  ): Promise<ParametrosVigentes> {
    return this.parametros.vigentes(req.usuario.unidadeId, query.especialidadeId);
  }
}
