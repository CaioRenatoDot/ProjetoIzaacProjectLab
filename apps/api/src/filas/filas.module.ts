import { Module } from '@nestjs/common';

import { ParametrosModule } from '../parametros/parametros.module';
import { SenhasModule } from '../senhas/senhas.module';
import { ChamadasService } from './chamadas.service';
import { ChamadasController, FilasController } from './filas.controller';
import { FilasRepository } from './filas.repository';
import { FilasService } from './filas.service';

@Module({
  imports: [ParametrosModule, SenhasModule],
  controllers: [FilasController, ChamadasController],
  providers: [FilasService, FilasRepository, ChamadasService],
})
export class FilasModule {}
