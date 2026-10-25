import { Module } from '@nestjs/common';

import { ParametrosModule } from '../parametros/parametros.module';
import { TriagemModule } from '../triagem/triagem.module';
import { MaquinaSenha } from './maquina/maquina-senha.service';
import { SenhaProjecao } from './senha-projecao.service';
import { SenhasController } from './senhas.controller';
import { SenhasRepository } from './senhas.repository';
import { SenhasService } from './senhas.service';

@Module({
  imports: [ParametrosModule, TriagemModule],
  controllers: [SenhasController],
  providers: [SenhasService, SenhasRepository, SenhaProjecao, MaquinaSenha],
  exports: [SenhasService, SenhasRepository, SenhaProjecao, MaquinaSenha],
})
export class SenhasModule {}
