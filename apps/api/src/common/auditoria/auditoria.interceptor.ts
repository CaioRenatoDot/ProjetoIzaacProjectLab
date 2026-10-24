import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type OperacaoAuditoria } from '@prisma/client';
import { mergeMap, type Observable } from 'rxjs';

import { type RequisicaoAutenticada } from '../../auth/usuario-autenticado';
import {
  CHAVE_AUDITAR,
  CHAVE_LEITURA_SENSIVEL,
  CHAVE_REQUER,
  type OpcoesAuditoria,
} from '../autorizacao/decorators';
import { AuditoriaService } from './auditoria.service';

const OPERACAO_POR_METODO: Record<string, OperacaoAuditoria> = {
  POST: 'CRIAR',
  PUT: 'EDITAR',
  PATCH: 'EDITAR',
  DELETE: 'EXCLUIR',
};

/**
 * Auditoria implícita (docs/01 §4.2, RNF-05): toda escrita autenticada e toda leitura marcada
 * com `@LeituraSensivel()` vão para o `audit_log` depois do handler e **antes** da resposta sair.
 * Se o registro falhar, a resposta vira 500: dado clínico nunca sai sem registro.
 * Rotas públicas (login, refresh, logout) não passam aqui; o AuthService grava LOGIN e LOGOUT.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const opcoes = this.reflector.get<OpcoesAuditoria | undefined>(
      CHAVE_AUDITAR,
      contexto.getHandler(),
    );
    const sensivel =
      this.reflector.get<boolean | undefined>(CHAVE_LEITURA_SENSIVEL, contexto.getHandler()) ??
      false;
    const operacao: OperacaoAuditoria | undefined =
      opcoes?.operacao ??
      (sensivel ? 'CONSULTAR_SENSIVEL' : OPERACAO_POR_METODO[requisicao.method]);

    return proximo.handle().pipe(
      mergeMap(async (resultado: unknown) => {
        if (operacao && requisicao.usuario) {
          const permissao = this.reflector.getAllAndOverride<string | undefined>(CHAVE_REQUER, [
            contexto.getHandler(),
            contexto.getClass(),
          ]);
          const corpo = requisicao.body as Record<string, unknown> | undefined;
          await this.auditoria.registrar({
            usuarioId: requisicao.usuario.id,
            perfilNomeNoMomento: requisicao.usuario.perfilNome,
            operacao,
            modulo: opcoes?.modulo ?? permissao?.split(':')[0] ?? 'desconhecido',
            entidade: opcoes?.entidade ?? contexto.getClass().name.replace(/Controller$/, ''),
            entidadeId: idDaEntidade(requisicao.params, resultado),
            justificativa: typeof corpo?.justificativa === 'string' ? corpo.justificativa : null,
            origemIp: requisicao.ip,
            userAgent: requisicao.headers['user-agent'],
            requestId: requisicao.headers['x-request-id'] as string | undefined,
            sensivel: operacao === 'CONSULTAR_SENSIVEL',
          });
        }
        return resultado;
      }),
    );
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `:id` da rota ou o `id` devolvido na criação; só UUID vai para a coluna. */
function idDaEntidade(parametros: Record<string, unknown>, resultado: unknown): string | null {
  const candidato =
    (typeof parametros.id === 'string' ? parametros.id : undefined) ??
    (typeof resultado === 'object' && resultado !== null && 'id' in resultado
      ? String(resultado.id)
      : undefined);
  return candidato && UUID.test(candidato) ? candidato : null;
}
