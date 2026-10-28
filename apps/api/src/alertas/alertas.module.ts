import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../common/auditoria/auditoria.module';
import { EventosDominioModule } from '../common/eventos/eventos-dominio';
import { RelogioModule } from '../common/relogio';
import { ParametrosModule } from '../parametros/parametros.module';
import { AlertasController } from './alertas.controller';
import { AlertasRepository } from './alertas.repository';
import { AlertasService } from './alertas.service';

@Module({
  imports: [AuditoriaModule, EventosDominioModule, RelogioModule, ParametrosModule],
  controllers: [AlertasController],
  providers: [AlertasRepository, AlertasService],
})
export class AlertasModule {}
