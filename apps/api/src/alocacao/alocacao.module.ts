import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../common/auditoria/auditoria.module';

import { ParametrosModule } from '../parametros/parametros.module';
import { SenhasModule } from '../senhas/senhas.module';
import { AlocacaoController } from './alocacao.controller';
import { AlocacaoRepository } from './alocacao.repository';
import { AlocacaoService } from './alocacao.service';
import { AptidaoAlocacaoService } from './aptidao-alocacao.service';
import { SugestoesService } from './sugestoes.service';

@Module({
  imports: [ParametrosModule, SenhasModule, AuditoriaModule],
  controllers: [AlocacaoController],
  providers: [AlocacaoService, AlocacaoRepository, AptidaoAlocacaoService, SugestoesService],
  exports: [AlocacaoService],
})
export class AlocacaoModule {}
