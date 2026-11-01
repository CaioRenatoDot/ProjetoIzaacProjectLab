import { Module } from '@nestjs/common';

import { PerfisController } from './perfis.controller';
import { PerfisRepository } from './perfis.repository';
import { PerfisService } from './perfis.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

@Module({
  controllers: [PerfisController, UsuariosController],
  providers: [PerfisService, PerfisRepository, UsuariosService, UsuariosRepository],
})
export class PerfisModule {}
