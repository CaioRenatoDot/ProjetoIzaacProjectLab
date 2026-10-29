/**
 * Variáveis dos servidores nos testes reais. Partem do `.env` da raiz, com o banco trocado pelo
 * `filas_test` (DATABASE_URL_TEST e DIRECT_URL_TEST). No CI, o workflow define as mesmas variáveis.
 */
import path from 'node:path';

import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} não definida. Copie o .env.example para .env na raiz.`);
  return valor;
}

/** Unidade criada pelo seed (apps/api/prisma/seed/dados.ts, UNIDADE). */
export const UNIDADE_DO_SEED = '01900000-0000-7000-8000-000000000001';

export const SENHA_DO_SEED = process.env.SEED_SENHA_USUARIOS ?? 'senha-dev';

export const AMBIENTE_REAL = {
  DATABASE_URL: obrigatoria('DATABASE_URL_TEST'),
  DIRECT_URL: obrigatoria('DIRECT_URL_TEST'),
  JWT_SEGREDO: obrigatoria('JWT_SEGREDO'),
  SEED_SENHA_USUARIOS: SENHA_DO_SEED,
  CORS_ORIGENS: 'http://localhost:3000,http://localhost:3001',
  LOG_LEVEL: 'warn',
};
