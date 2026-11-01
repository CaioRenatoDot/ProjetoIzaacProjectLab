import { Module } from '@nestjs/common';

import { SenhasModule } from '../senhas/senhas.module';
import { TriagemModule } from '../triagem/triagem.module';
import { AtendimentosController, IniciarAtendimentoController } from './atendimentos.controller';
import { AtendimentosRepository } from './atendimentos.repository';
import { AtendimentosService } from './atendimentos.service';

@Module({
  imports: [SenhasModule, TriagemModule],
  controllers: [AtendimentosController, IniciarAtendimentoController],
  providers: [AtendimentosService, AtendimentosRepository],
})
export class AtendimentosModule {}
