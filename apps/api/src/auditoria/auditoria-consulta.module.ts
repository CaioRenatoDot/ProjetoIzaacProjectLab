import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../common/auditoria/auditoria.module';
import { AuditoriaConsultaController } from './auditoria-consulta.controller';
import { AuditoriaConsultaService } from './auditoria-consulta.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [AuditoriaConsultaController],
  providers: [AuditoriaConsultaService],
})
export class AuditoriaConsultaModule {}
