import { Module } from '@nestjs/common';

import { ParametrosModule } from '../parametros/parametros.module';
import { TriagemModule } from '../triagem/triagem.module';
import { SenhasController } from './senhas.controller';
import { SenhasRepository } from './senhas.repository';
import { SenhasService } from './senhas.service';

@Module({
  imports: [ParametrosModule, TriagemModule],
  controllers: [SenhasController],
  providers: [SenhasService, SenhasRepository],
  exports: [SenhasService],
})
export class SenhasModule {}
