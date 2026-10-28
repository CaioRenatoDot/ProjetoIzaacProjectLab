import { SetMetadata } from '@nestjs/common';
import { type Permissao } from '@filas/contracts';
import { type OperacaoAuditoria } from '@prisma/client';
import { type Request } from 'express';

export const CHAVE_REQUER = 'autorizacao:requer';
export const CHAVE_PUBLICO = 'autorizacao:publico';
export const CHAVE_AUTENTICADO = 'autorizacao:autenticado';
export const CHAVE_LEITURA_SENSIVEL = 'auditoria:leitura-sensivel';
export const CHAVE_AUDITAR = 'auditoria:auditar';

/** Exige sessão e a permissão `modulo:operacao` do catálogo (docs/04 §3). */
export const Requer = (permissao: Permissao) => SetMetadata(CHAVE_REQUER, permissao);

/** Rota sem autenticação: login, refresh, logout, health e `/publico/*`. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);

/** Exige só a sessão, sem permissão própria (ex.: `GET /auth/me`). */
export const Autenticado = () => SetMetadata(CHAVE_AUTENTICADO, true);

/** Decide pela requisição se a leitura é sensível (ex.: `?incluirTriagem=true`). */
export type CondicaoSensivel = (requisicao: Request) => boolean;

/**
 * Leitura de dado de saúde: grava `CONSULTAR_SENSIVEL` antes de responder (ADR-003, RNF-07).
 * Com `quando`, só a requisição que traz o dado clínico é registrada.
 */
export const LeituraSensivel = (quando?: CondicaoSensivel) =>
  SetMetadata(CHAVE_LEITURA_SENSIVEL, quando ?? true);

export interface OpcoesAuditoria {
  /** O service grava a auditoria na transação da escrita; o interceptador não a duplica. */
  naTransacao?: boolean;
  /** Padrão: o módulo da permissão exigida. */
  modulo?: string;
  /** Nome da entidade gravada em `audit_log.entidade`. */
  entidade: string;
  /** Padrão: pelo método HTTP (POST criar, PUT/PATCH editar, DELETE excluir). */
  operacao?: OperacaoAuditoria;
}

/** Ajusta o registro automático de auditoria de uma rota. */
export const Auditar = (opcoes: OpcoesAuditoria) => SetMetadata(CHAVE_AUDITAR, opcoes);
