import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';

import { type Ambiente } from '../config/ambiente';
import { AUDIENCIA_TOKEN, EMISSOR_TOKEN } from './sessao.constantes';

/** Conteúdo do access token (docs/04 §2), mais `sid` para conferir a sessão a cada requisição. */
export interface ConteudoToken {
  sub: string;
  sid: string;
  nome: string;
  perfilId: string;
  perfilNome: string;
  unidadeId: string;
  permissoes: string[];
}

@Injectable()
export class TokenAcessoService {
  private readonly segredo: string;

  constructor(config: ConfigService<Ambiente, true>) {
    this.segredo = config.get('JWT_SEGREDO', { infer: true });
  }

  assinar(conteudo: ConteudoToken, segundos: number): string {
    return sign(conteudo, this.segredo, {
      algorithm: 'HS256',
      expiresIn: segundos,
      issuer: EMISSOR_TOKEN,
      audience: AUDIENCIA_TOKEN,
    });
  }

  /**
   * Algoritmo, emissor e audiência fixos: sem isso, um token `alg: none` ou assinado com outra
   * chave poderia passar. Token inválido ou expirado devolve `null`.
   */
  verificar(token: string): ConteudoToken | null {
    try {
      const conteudo = verify(token, this.segredo, {
        algorithms: ['HS256'],
        issuer: EMISSOR_TOKEN,
        audience: AUDIENCIA_TOKEN,
      });
      if (typeof conteudo === 'string' || !conteudo.sub || typeof conteudo.sid !== 'string') {
        return null;
      }
      return conteudo as unknown as ConteudoToken;
    } catch {
      return null;
    }
  }
}
