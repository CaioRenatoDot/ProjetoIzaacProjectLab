import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import {
  ExportarIndicadoresQuery,
  IndicadoresQuery,
  type IndicadoresResumo,
  type VolumePorEspecialidade,
  VolumeQuery,
} from '@filas/contracts';
import { type Request, type Response } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Requer } from '../common/autorizacao/decorators';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { IndicadoresService } from './indicadores.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get('resumo')
  @Requer('indicadores:consultar')
  resumo(
    @Query(new ZodValidationPipe(IndicadoresQuery)) query: IndicadoresQuery,
    @Req() req: Requisicao,
  ): Promise<IndicadoresResumo> {
    return this.indicadores.resumo(query, req.usuario.unidadeId);
  }

  @Get('volume-por-especialidade')
  @Requer('indicadores:consultar')
  volume(
    @Query(new ZodValidationPipe(VolumeQuery)) query: VolumeQuery,
    @Req() req: Requisicao,
  ): Promise<VolumePorEspecialidade> {
    return this.indicadores.volume(query, req.usuario.unidadeId);
  }

  @Get('exportacao')
  @Requer('indicadores:exportar')
  async exportar(
    @Query(new ZodValidationPipe(ExportarIndicadoresQuery)) query: ExportarIndicadoresQuery,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.indicadores.exportar(query, req.usuario, {
      origemIp: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="indicadores.csv"');
    return csv;
  }
}
