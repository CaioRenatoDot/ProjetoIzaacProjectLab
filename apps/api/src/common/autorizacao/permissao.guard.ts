import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Permissao } from '@filas/contracts';

import { AuthService } from '../../auth/auth.service';
import { type RequisicaoAutenticada } from '../../auth/usuario-autenticado';
import { CHAVE_AUTENTICADO, CHAVE_PUBLICO, CHAVE_REQUER } from './decorators';

type Exigencia =
  { tipo: 'publico' } | { tipo: 'sessao' } | { tipo: 'permissao'; permissao: Permissao };

/**
 * Guard global (docs/04 §3): nega por padrão. O decorator do método prevalece sobre o da
 * classe, para que um `@Publico()` na classe nunca libere um método com `@Requer`.
 * Sem token válido: 401. Sem a permissão: 403 neutro, inclusive para recurso inexistente,
 * porque a decisão acontece antes do handler.
 */
@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const exigencia = this.exigencia(contexto);
    if (!exigencia) throw new ForbiddenException();
    if (exigencia.tipo === 'publico') return true;

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const [tipo, token] = (requisicao.headers.authorization ?? '').split(' ');
    const usuario = tipo === 'Bearer' && token ? await this.auth.autenticar(token) : null;
    if (!usuario) throw new UnauthorizedException();
    requisicao.usuario = usuario;

    if (exigencia.tipo === 'permissao' && !usuario.permissoes.includes(exigencia.permissao)) {
      throw new ForbiddenException();
    }
    return true;
  }

  private exigencia(contexto: ExecutionContext): Exigencia | null {
    for (const alvo of [contexto.getHandler(), contexto.getClass()]) {
      const permissao = this.reflector.get<Permissao | undefined>(CHAVE_REQUER, alvo);
      if (permissao) return { tipo: 'permissao', permissao };
      if (this.reflector.get<boolean | undefined>(CHAVE_PUBLICO, alvo)) return { tipo: 'publico' };
      if (this.reflector.get<boolean | undefined>(CHAVE_AUTENTICADO, alvo))
        return { tipo: 'sessao' };
    }
    return null;
  }
}
