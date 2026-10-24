import { Module } from '@nestjs/common';

import { ApoioController } from './apoio.controller';
import { EspecialidadesController, SalasController } from './cadastros.controller';
import { EspecialidadesService } from './especialidades.service';
import { SalasService } from './salas.service';

@Module({
  controllers: [ApoioController, SalasController, EspecialidadesController],
  providers: [SalasService, EspecialidadesService],
})
export class CadastrosModule {}
