import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FilasModule } from '../filas/filas.module';
import { SocketAuthService } from './socket-auth.service';
import { TempoRealGateway } from './tempo-real.gateway';
import { TempoRealRepository } from './tempo-real.repository';

@Module({
  imports: [AuthModule, FilasModule],
  providers: [TempoRealGateway, SocketAuthService, TempoRealRepository],
})
export class TempoRealModule {}
