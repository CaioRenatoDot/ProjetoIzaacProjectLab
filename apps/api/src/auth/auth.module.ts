import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../common/auditoria/auditoria.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { TokenAcessoService } from './token-acesso.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, TokenAcessoService],
  exports: [AuthService],
})
export class AuthModule {}
