import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { type Request, type Response } from 'express';

import { ErroDominio } from '../common/errors/erro-dominio';
import { PublicoService } from './publico.service';

@Injectable()
export class PublicoLimiteGuard implements CanActivate {
  constructor(private readonly publico: PublicoService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const http = contexto.switchToHttp();
    const req = http.getRequest<Request>();
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
    const espera = this.publico.verificarLimite(
      req.ip ?? req.socket.remoteAddress ?? 'desconhecido',
    );
    if (espera !== null) {
      http.getResponse<Response>().setHeader('Retry-After', espera);
      throw new ErroDominio(
        'LIMITE_REQUISICOES',
        429,
        'Limite de requisições atingido',
        'Aguarde antes de consultar novamente.',
      );
    }
    return true;
  }
}
