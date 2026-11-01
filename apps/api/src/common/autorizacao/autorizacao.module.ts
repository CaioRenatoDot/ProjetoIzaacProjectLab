import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from '../../auth/auth.module';
import { AuditoriaInterceptor } from '../auditoria/auditoria.interceptor';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PermissaoGuard } from './permissao.guard';

/** Guard de permissão e interceptador de auditoria globais: valem para toda rota da API. */
@Module({
  imports: [AuthModule, AuditoriaModule],
  providers: [
    { provide: APP_GUARD, useClass: PermissaoGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AutorizacaoModule {}
