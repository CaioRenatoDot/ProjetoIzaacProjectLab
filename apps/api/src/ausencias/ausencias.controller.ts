import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { DesistenciaEntrada, type DesistenciaResposta } from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { DesistenciasService } from './desistencias.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('senhas/:id')
export class AusenciasController {
  constructor(private readonly desistencias: DesistenciasService) {}

  @Post('desistencia')
  @Requer('ausencia:criar')
  @HttpCode(200)
  @Auditar({ entidade: 'desistencia', operacao: 'CRIAR' })
  desistir(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(DesistenciaEntrada)) entrada: DesistenciaEntrada,
    @Req() req: Requisicao,
  ): Promise<DesistenciaResposta> {
    return this.desistencias.registrar(id, entrada, req.usuario.id, req.usuario.unidadeId);
  }
}
