import { Module } from '@nestjs/common';

import { RelogioModule } from '../common/relogio';
import { TempoRealRepository } from '../tempo-real/tempo-real.repository';
import { PublicoLimiteGuard } from './publico-limite.guard';
import { PublicoController } from './publico.controller';
import { PublicoRepository } from './publico.repository';
import { PublicoService } from './publico.service';

@Module({
  imports: [RelogioModule],
  controllers: [PublicoController],
  providers: [PublicoService, PublicoRepository, PublicoLimiteGuard, TempoRealRepository],
})
export class PublicoModule {}
