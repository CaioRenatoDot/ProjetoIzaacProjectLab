import { Module } from '@nestjs/common';
import { AlocacaoModule } from '../alocacao/alocacao.module';
import { AuditoriaModule } from '../common/auditoria/auditoria.module';
import { EventosDominioModule } from '../common/eventos/eventos-dominio';
import { RelogioModule } from '../common/relogio';
import { BloqueioRepository } from './bloqueio.repository';
import { BloqueioService } from './bloqueio.service';

import { ParametrosModule } from '../parametros/parametros.module';
import { SenhasModule } from '../senhas/senhas.module';
import { ChamadasService } from './chamadas.service';
import { ChamadasController, FilasController } from './filas.controller';
import { FilasRepository } from './filas.repository';
import { FilasService } from './filas.service';

@Module({
  imports: [
    ParametrosModule,
    SenhasModule,
    AlocacaoModule,
    RelogioModule,
    EventosDominioModule,
    AuditoriaModule,
  ],
  controllers: [FilasController, ChamadasController],
  providers: [FilasService, FilasRepository, ChamadasService, BloqueioRepository, BloqueioService],
  exports: [FilasRepository, BloqueioService],
})
export class FilasModule {}
