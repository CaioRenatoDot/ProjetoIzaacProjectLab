import { Module } from '@nestjs/common';

import { SenhasModule } from '../senhas/senhas.module';
import { AusenciasController } from './ausencias.controller';
import { DesistenciasService } from './desistencias.service';

@Module({
  imports: [SenhasModule],
  controllers: [AusenciasController],
  providers: [DesistenciasService],
})
export class AusenciasModule {}
