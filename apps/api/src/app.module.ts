import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validarAmbiente } from './config/ambiente';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // O .env fica na raiz do monorepo; os caminhos são relativos a apps/api,
      // de onde o pnpm --filter api executa os scripts.
      envFilePath: ['.env', '../../.env'],
      validate: validarAmbiente,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
