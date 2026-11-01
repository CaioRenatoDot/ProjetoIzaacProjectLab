import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  COOKIE_REFRESH,
  LoginEntrada,
  type LoginResposta,
  type RenovacaoResposta,
  type UsuarioSessao,
} from '@filas/contracts';
import { type CookieOptions, type Request, type Response } from 'express';

import { Autenticado, Publico } from '../common/autorizacao/decorators';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AuthService, type ContextoRequisicao, type SessaoEmitida } from './auth.service';
import { CAMINHO_COOKIE_REFRESH } from './sessao.constantes';
import { type UsuarioAutenticado } from './usuario-autenticado';

const OPCOES_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: CAMINHO_COOKIE_REFRESH,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(200)
  async entrar(
    @Body(new ZodValidationPipe(LoginEntrada)) entrada: LoginEntrada,
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<LoginResposta> {
    const resultado = await this.auth.entrar(entrada, contextoDe(requisicao));
    gravarCookie(resposta, resultado.sessao);
    return resultado.resposta;
  }

  @Post('refresh')
  @Publico()
  @HttpCode(200)
  async renovar(
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<RenovacaoResposta> {
    try {
      const resultado = await this.auth.renovar(cookieDe(requisicao));
      gravarCookie(resposta, resultado.sessao);
      return resultado.resposta;
    } catch (erro) {
      limparCookie(resposta);
      throw erro;
    }
  }

  @Post('logout')
  @Publico()
  @HttpCode(204)
  async encerrar(
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    await this.auth.encerrar(cookieDe(requisicao), contextoDe(requisicao));
    limparCookie(resposta);
  }

  @Get('me')
  @Autenticado()
  sessaoAtual(@Req() requisicao: Request & { usuario: UsuarioAutenticado }): UsuarioSessao {
    const { sessaoId: _sessaoId, ...usuario } = requisicao.usuario;
    return usuario;
  }
}

function cookieDe(requisicao: Request): unknown {
  return (requisicao.cookies as Record<string, unknown> | undefined)?.[COOKIE_REFRESH];
}

function contextoDe(requisicao: Request): ContextoRequisicao {
  return {
    origemIp: requisicao.ip,
    userAgent: requisicao.headers['user-agent'],
    requestId: requisicao.headers['x-request-id'] as string | undefined,
  };
}

/** Sem `manterConectado`, cookie de sessão (sem Max-Age); com ele, persistente até o fim da sessão. */
function gravarCookie(resposta: Response, sessao: SessaoEmitida): void {
  resposta.cookie(COOKIE_REFRESH, sessao.refresh, {
    ...OPCOES_COOKIE,
    ...(sessao.manterConectado ? { maxAge: sessao.expiraEm.getTime() - Date.now() } : {}),
  });
}

/** `res.clearCookie` do Express 5 não emite Max-Age; `maxAge: 0` garante a remoção. */
function limparCookie(resposta: Response): void {
  resposta.cookie(COOKIE_REFRESH, '', { ...OPCOES_COOKIE, maxAge: 0 });
}
