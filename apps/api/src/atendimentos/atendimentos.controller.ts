import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import {
  type AtendimentoDetalhe,
  type AtendimentoResumo,
  type EncerramentoResposta,
  EncerrarEntrada,
  ListarAtendimentosQuery,
  PausarEntrada,
  type RespostaPaginada,
  ValidarEntrada,
  VersaoEntrada,
} from '@filas/contracts';
import { type Request } from 'express';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { Auditar, LeituraSensivel, Requer } from '../common/autorizacao/decorators';
import { IdPipe } from '../common/validation/id.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AtendimentosService } from './atendimentos.service';

type Requisicao = Request & { usuario: UsuarioAutenticado };

@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentos: AtendimentosService) {}

  @Get()
  @Requer('atendimento:consultar')
  listar(
    @Query(new ZodValidationPipe(ListarAtendimentosQuery)) query: ListarAtendimentosQuery,
    @Req() req: Requisicao,
  ): Promise<RespostaPaginada<AtendimentoResumo>> {
    return this.atendimentos.listar(query, req.usuario.unidadeId);
  }

  @Get(':id')
  @Requer('atendimento:consultar_sensivel')
  @LeituraSensivel()
  @Auditar({ entidade: 'atendimento' })
  consultar(@Param('id', IdPipe) id: string, @Req() req: Requisicao): Promise<AtendimentoDetalhe> {
    return this.atendimentos.consultar(id, req.usuario.unidadeId);
  }

  @Post(':id/pausa')
  @Requer('atendimento:editar')
  @HttpCode(200)
  @Auditar({ entidade: 'atendimento', operacao: 'EDITAR' })
  pausar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(PausarEntrada)) entrada: PausarEntrada,
    @Req() req: Requisicao,
  ): Promise<AtendimentoResumo> {
    return this.atendimentos.pausar(id, entrada, req.usuario.id, req.usuario.unidadeId);
  }

  @Post(':id/retomada')
  @Requer('atendimento:editar')
  @HttpCode(200)
  @Auditar({ entidade: 'atendimento', operacao: 'EDITAR' })
  retomar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(VersaoEntrada)) entrada: VersaoEntrada,
    @Req() req: Requisicao,
  ): Promise<AtendimentoResumo> {
    return this.atendimentos.retomar(id, entrada.versao, req.usuario.unidadeId);
  }

  @Post(':id/encerramento')
  @Requer('atendimento:editar')
  @HttpCode(200)
  @Auditar({ entidade: 'atendimento', operacao: 'EDITAR' })
  encerrar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(EncerrarEntrada)) entrada: EncerrarEntrada,
    @Req() req: Requisicao,
  ): Promise<EncerramentoResposta> {
    return this.atendimentos.encerrar(id, entrada, req.usuario.unidadeId);
  }

  @Post(':id/validacao')
  @Requer('atendimento:validar')
  @HttpCode(200)
  @Auditar({ entidade: 'atendimento', operacao: 'EDITAR' })
  validar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(ValidarEntrada)) entrada: ValidarEntrada,
    @Req() req: Requisicao,
  ): Promise<AtendimentoResumo> {
    return this.atendimentos.validar(id, entrada, req.usuario.id, req.usuario.unidadeId);
  }
}

@Controller('senhas/:id/atendimento')
export class IniciarAtendimentoController {
  constructor(private readonly atendimentos: AtendimentosService) {}

  @Post()
  @Requer('atendimento:criar')
  @Auditar({ entidade: 'atendimento' })
  iniciar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(VersaoEntrada)) entrada: VersaoEntrada,
    @Req() req: Requisicao,
  ): Promise<AtendimentoResumo> {
    return this.atendimentos.iniciar(id, entrada.versao, req.usuario.unidadeId);
  }
}
