import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../common/auditoria/auditoria.module';
import { ParametrosModule } from '../parametros/parametros.module';
import { SenhasModule } from '../senhas/senhas.module';
import { AusenciasController } from './ausencias.controller';
import { AusenciasService } from './ausencias.service';
import { DesistenciasService } from './desistencias.service';
import { ToleranciaRotina } from './tolerancia.rotina';

@Module({
  imports: [SenhasModule, ParametrosModule, AuditoriaModule],
  controllers: [AusenciasController],
  providers: [DesistenciasService, AusenciasService, ToleranciaRotina],
})
export class AusenciasModule {}
