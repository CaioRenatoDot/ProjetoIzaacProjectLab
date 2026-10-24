import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type CodigoErro, type Problema } from '@filas/contracts';
import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';

import { ErroDominio } from './erro-dominio';

type CorpoProblema = Problema & Record<string, unknown>;

/** Mensagens do body-parser para JSON malformado (Express 5 / Node 22+). */
const JSON_MALFORMADO =
  /^(Unexpected |Expected |JSON\.parse|Unterminated )|in JSON at position|is not valid JSON/;

const PADRAO_POR_STATUS: Record<number, { codigo: CodigoErro; titulo: string; detalhe: string }> = {
  [HttpStatus.UNAUTHORIZED]: {
    codigo: 'NAO_AUTENTICADO',
    titulo: 'Sessão não autenticada',
    detalhe: 'Entre novamente no sistema para continuar.',
  },
  [HttpStatus.FORBIDDEN]: {
    codigo: 'SEM_PERMISSAO',
    titulo: 'Acesso não autorizado',
    detalhe: 'Seu perfil não tem acesso a esta operação. Procure a administração do sistema.',
  },
  [HttpStatus.NOT_FOUND]: {
    codigo: 'NAO_ENCONTRADO',
    titulo: 'Recurso não encontrado',
    detalhe: 'O endereço solicitado não existe. Confira o caminho e tente novamente.',
  },
};

const ERRO_INTERNO: CorpoProblema = {
  type: 'about:blank',
  title: 'Erro interno',
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  codigo: 'ERRO_INTERNO',
  detail:
    'Não foi possível concluir a operação. Tente novamente; se persistir, informe o código da requisição à administração.',
};

/**
 * Converte toda exceção em application/problem+json (RFC 7807 + `codigo`, docs/04 §4).
 * Exceção inesperada vira 500 genérico: a stack vai só para o log, com o X-Request-Id.
 */
@Catch()
export class ProblemaFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemaFilter.name);

  catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const requisicao = contexto.getRequest<Request>();
    const resposta = contexto.getResponse<Response>();

    const corpo = this.converter(excecao, requisicao);
    if (corpo.status >= 500 && !(excecao instanceof ErroDominio)) {
      this.logger.error(
        { err: excecao, requestId: requisicao.headers['x-request-id'] },
        'Erro inesperado na requisição',
      );
    }

    resposta.status(corpo.status).type('application/problem+json').json(corpo);
  }

  private converter(excecao: unknown, requisicao: Request): CorpoProblema {
    const instance = requisicao.path;

    if (excecao instanceof ErroDominio) {
      return {
        type: 'about:blank',
        title: excecao.titulo,
        status: excecao.status,
        codigo: excecao.codigo,
        ...(excecao.detalhe ? { detail: excecao.detalhe } : {}),
        instance,
        ...excecao.extras,
      };
    }

    if (excecao instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...this.deErroPrisma(excecao), instance };
    }

    if (this.ehJsonMalformado(excecao)) {
      return {
        type: 'about:blank',
        title: 'Corpo inválido',
        status: HttpStatus.BAD_REQUEST,
        codigo: 'CORPO_INVALIDO',
        detail: 'O corpo da requisição não é um JSON válido. Corrija o formato e envie novamente.',
        instance,
      };
    }

    if (excecao instanceof HttpException) {
      const resposta = excecao.getResponse();
      // Quem já lança no formato do contrato (ex.: readiness com BANCO_INDISPONIVEL) é respeitado.
      if (typeof resposta === 'object' && resposta !== null && 'codigo' in resposta) {
        return { instance, ...(resposta as CorpoProblema), status: excecao.getStatus() };
      }
      const padrao = PADRAO_POR_STATUS[excecao.getStatus()];
      if (padrao) {
        return {
          type: 'about:blank',
          title: padrao.titulo,
          status: excecao.getStatus(),
          codigo: padrao.codigo,
          detail: padrao.detalhe,
          instance,
        };
      }
    }

    return { ...ERRO_INTERNO, instance };
  }

  private deErroPrisma(erro: Prisma.PrismaClientKnownRequestError): CorpoProblema {
    switch (erro.code) {
      case 'P2002':
        return {
          type: 'about:blank',
          title: 'Registro já cadastrado',
          status: HttpStatus.CONFLICT,
          codigo: 'DUPLICIDADE',
          detail: 'Já existe um registro com estes dados. Confira o cadastro existente.',
        };
      case 'P2003':
        return {
          type: 'about:blank',
          title: 'Registro com vínculo ativo',
          status: HttpStatus.CONFLICT,
          codigo: 'VINCULO_ATIVO',
          detail: 'O registro está vinculado a outros dados e não pode ser removido. Inative-o.',
        };
      case 'P2025':
        return {
          type: 'about:blank',
          title: 'Registro não encontrado',
          status: HttpStatus.NOT_FOUND,
          codigo: 'NAO_ENCONTRADO',
          detail: 'O registro não existe ou foi removido.',
        };
      default:
        return ERRO_INTERNO;
    }
  }

  private ehJsonMalformado(excecao: unknown): boolean {
    if (excecao instanceof SyntaxError) return true;
    if (!(excecao instanceof BadRequestException)) return false;
    const resposta = excecao.getResponse();
    const mensagem =
      typeof resposta === 'object' && resposta !== null && 'message' in resposta
        ? String(resposta.message)
        : excecao.message;
    return JSON_MALFORMADO.test(mensagem);
  }
}
