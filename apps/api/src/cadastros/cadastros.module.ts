import { Module } from '@nestjs/common';

import { ApoioController } from './apoio.controller';
import { EspecialidadesController, SalasController } from './cadastros.controller';
import { EspecialidadesService } from './especialidades.service';
import { EstudantesService } from './estudantes.service';
import { PacientesService } from './pacientes.service';
import {
  EstudantesController,
  PacientesController,
  SupervisoresController,
} from './pessoas.controller';
import { SalasService } from './salas.service';
import { SupervisoresService } from './supervisores.service';

@Module({
  controllers: [
    ApoioController,
    SalasController,
    EspecialidadesController,
    PacientesController,
    EstudantesController,
    SupervisoresController,
  ],
  providers: [
    SalasService,
    EspecialidadesService,
    PacientesService,
    EstudantesService,
    SupervisoresService,
  ],
})
export class CadastrosModule {}
