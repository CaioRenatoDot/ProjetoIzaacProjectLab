import { Injectable } from '@nestjs/common';
import { type Permissao } from '@filas/contracts';
import { decode } from 'jsonwebtoken';
import { type Socket } from 'socket.io';
import { z } from 'zod';

import { AuthService } from '../auth/auth.service';
import { TempoRealRepository } from './tempo-real.repository';

export type Canal = '/filas' | '/painel' | '/alertas';
export interface Inscricao {
  sala: string;
  unidadeId: string;
  token?: string;
  permissao?: Permissao;
  expira?: number;
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly auth: AuthService,
    private readonly repositorio: TempoRealRepository,
  ) {}

  async autorizar(socket: Socket, canal: Canal): Promise<Inscricao> {
    if (canal === '/painel') {
      const unidadeId = z.uuid().parse(socket.handshake.query.unidadeId);
      if (!(await this.repositorio.unidade(unidadeId))) throw new Error('SEM_PERMISSAO');
      return { sala: `unidade:${unidadeId}`, unidadeId };
    }
    const token: unknown = (socket.handshake.auth as Record<string, unknown>).token;
    const usuario = typeof token === 'string' ? await this.auth.autenticar(token) : null;
    if (!usuario) throw new Error('NAO_AUTENTICADO');
    const permissao = canal === '/filas' ? 'fila:consultar' : 'alertas:consultar';
    if (!usuario.permissoes.includes(permissao)) throw new Error('SEM_PERMISSAO');
    const conteudo = decode(token as string);
    if (!conteudo || typeof conteudo === 'string' || !conteudo.exp)
      throw new Error('NAO_AUTENTICADO');
    let sala = `unidade:${usuario.unidadeId}`;
    if (canal === '/filas') {
      const especialidadeId = z.uuid().parse(socket.handshake.query.especialidadeId);
      if (!(await this.repositorio.especialidade(especialidadeId, usuario.unidadeId)))
        throw new Error('SEM_PERMISSAO');
      sala = `especialidade:${especialidadeId}`;
    }
    if (socket.handshake.query.unidadeId && socket.handshake.query.unidadeId !== usuario.unidadeId)
      throw new Error('SEM_PERMISSAO');
    return {
      sala,
      unidadeId: usuario.unidadeId,
      token: token as string,
      permissao,
      expira: conteudo.exp * 1000,
    };
  }

  /** Sessão revogada ou permissão/unidade alterada também encerra o socket já conectado. */
  async vigente(inscricao: Inscricao): Promise<boolean> {
    if (!inscricao.token || !inscricao.permissao) return false;
    const usuario = await this.auth.autenticar(inscricao.token);
    return (
      !!usuario &&
      usuario.unidadeId === inscricao.unidadeId &&
      usuario.permissoes.includes(inscricao.permissao)
    );
  }
}
