import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../common/auditoria/auditoria.module';
import { EventosDominioModule } from '../common/eventos/eventos-dominio';
import { SenhasModule } from '../senhas/senhas.module';
import { EncaminhamentosController } from './encaminhamentos.controller';
import { EncaminhamentosRepository } from './encaminhamentos.repository';
import { EncaminhamentosService } from './encaminhamentos.service';

@Module({
  imports: [SenhasModule, AuditoriaModule, EventosDominioModule],
  controllers: [EncaminhamentosController],
  providers: [EncaminhamentosService, EncaminhamentosRepository],
})
export class EncaminhamentosModule {}
