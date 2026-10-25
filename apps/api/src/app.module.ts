import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AlocacaoModule } from './alocacao/alocacao.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { AusenciasModule } from './ausencias/ausencias.module';
import { AuditoriaConsultaModule } from './auditoria/auditoria-consulta.module';
import { AuthModule } from './auth/auth.module';
import { CadastrosModule } from './cadastros/cadastros.module';
import { AutorizacaoModule } from './common/autorizacao/autorizacao.module';
import { EventosDominioModule } from './common/eventos/eventos-dominio';
import { IdempotenciaModule } from './common/idempotencia/idempotencia.service';
import { RelogioModule } from './common/relogio';
import { opcoesLog } from './common/logging/opcoes-log';
import { type Ambiente, validarAmbiente } from './config/ambiente';
import { FilasModule } from './filas/filas.module';
import { HealthModule } from './health/health.module';
import { ParametrosModule } from './parametros/parametros.module';
import { PerfisModule } from './perfis/perfis.module';
import { PrismaModule } from './prisma/prisma.module';
import { SenhasModule } from './senhas/senhas.module';
import { TriagemModule } from './triagem/triagem.module';

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
    AutorizacaoModule,
    PerfisModule,
    CadastrosModule,
    AuditoriaConsultaModule,
    TriagemModule,
    EventosDominioModule,
    ParametrosModule,
    SenhasModule,
    IdempotenciaModule,
    FilasModule,
    AlocacaoModule,
    RelogioModule,
    AtendimentosModule,
    AusenciasModule,
  ],
})
export class AppModule {}
