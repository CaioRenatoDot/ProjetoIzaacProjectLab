import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { opcoesLog } from './common/logging/opcoes-log';
import { type Ambiente, validarAmbiente } from './config/ambiente';
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
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Ambiente, true>) => ({
        pinoHttp: opcoesLog(config.get('LOG_LEVEL', { infer: true })),
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
