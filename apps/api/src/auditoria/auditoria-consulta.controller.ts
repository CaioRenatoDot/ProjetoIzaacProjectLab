import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import {
  ConsultarAuditoriaQuery,
  type EventoAuditoria,
  type EventoAuditoriaDetalhe,
  ExportarAuditoriaQuery,
  type ItemReferencia,
  ListarApoioQuery,
  type RespostaPaginada,
} from '@filas/contracts';
import { type Request, type Response } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AuditoriaConsultaService } from './auditoria-consulta.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

// As rotas fixas vêm antes de `:id` para não serem lidas como identificador.
@Controller('auditoria')
export class AuditoriaConsultaController {
  constructor(private readonly servico: AuditoriaConsultaService) {}

  @Get()
  @Requer('auditoria:consultar')
  consultar(
    @Query(new ZodValidationPipe(ConsultarAuditoriaQuery)) query: ConsultarAuditoriaQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<EventoAuditoria>> {
    return this.servico.consultar(query, req.usuario.unidadeId);
  }

  @Get('usuarios')
  @Requer('auditoria:consultar')
  usuarios(
    @Query(new ZodValidationPipe(ListarApoioQuery)) query: ListarApoioQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<ItemReferencia>> {
    return this.servico.usuarios(query, req.usuario.unidadeId);
  }

  @Get('exportacao')
  @Requer('auditoria:exportar')
  async exportar(
    @Query(new ZodValidationPipe(ExportarAuditoriaQuery)) query: ExportarAuditoriaQuery,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.servico.exportar(query, req.usuario, {
      origemIp: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trilha-auditoria.csv"');
    return csv;
  }

  @Get(':id')
  @Requer('auditoria:consultar')
  detalhe(
    @Param('id', IdPipe) id: string,
    @Req() req: Requisicao,
  ): Promise<EventoAuditoriaDetalhe> {
    return this.servico.detalhe(id, req.usuario.unidadeId);
  }
}
