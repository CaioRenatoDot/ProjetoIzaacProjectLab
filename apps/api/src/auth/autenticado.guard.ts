import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';

import { AuthService } from './auth.service';
import { type UsuarioAutenticado } from './usuario-autenticado';

export type RequisicaoAutenticada = Request & { usuario: UsuarioAutenticado };

/**
 * Exige `Authorization: Bearer <accessToken>` válido e sessão aberta no banco.
 * A parte 3.2 (#11) generaliza isso num guard global com `@Requer`.
 */
@Injectable()
export class AutenticadoGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const [tipo, token] = (requisicao.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException();

    const usuario = await this.auth.autenticar(token);
    if (!usuario) throw new UnauthorizedException();
    requisicao.usuario = usuario;
    return true;
  }
}
