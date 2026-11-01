import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AuthModule } from '../../auth/auth.module';
import { gerarHashSenha } from '../../auth/senha';
import { validarAmbiente } from '../../config/ambiente';
import { PrismaModule } from '../../prisma/prisma.module';
import { AutorizacaoModule } from '../autorizacao/autorizacao.module';
import { garantirBancoDeTeste } from './banco-de-teste';
import { criarAppDeTeste, type AppDeTeste } from './criar-app-de-teste';

/** Unidade criada pela migração da parte 2.3 (#70). */
export const UNIDADE_PADRAO = '01900000-0000-7000-8000-000000000001';
const SENHA = 'senha-ficticia-de-teste';

/**
 * Aplicação de integração contra o filas_test, com autenticação e guard globais reais.
 * Conecta como o usuário da aplicação (DATABASE_URL_TEST).
 */
export async function criarAppIntegracao(
  metadata: ModuleMetadata,
): Promise<AppDeTeste & { prisma: PrismaClient }> {
  const url = garantirBancoDeTeste(process.env.DATABASE_URL_TEST);
  process.env.DATABASE_URL = url;
  process.env.JWT_SEGREDO ??= 'segredo-ficticio-de-teste-com-32-caracteres!';
  const contexto = await criarAppDeTeste({
    ...metadata,
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validarAmbiente }),
      PrismaModule,
      AuthModule,
      AutorizacaoModule,
      ...(metadata.imports ?? []),
    ],
  });
  return { ...contexto, prisma: new PrismaClient({ datasourceUrl: url }) };
}

let sequencia = 0;

export interface SessaoDeTeste {
  token: string;
  usuarioId: string;
  perfilId: string;
}

/** Cria perfil e usuário fictícios com as permissões pedidas e faz o login real. */
export async function entrarComPermissoes(
  contexto: AppDeTeste & { prisma: PrismaClient },
  permissoes: string[],
): Promise<SessaoDeTeste> {
  sequencia += 1;
  const marca = `${Date.now()}-${sequencia}`;
  const perfil = await contexto.prisma.perfil.create({
    data: {
      nome: `Perfil de teste ${marca}`,
      permissoes: { create: permissoes.map((permissao) => ({ permissao })) },
    },
  });
  const identificacao = `teste-${marca}@clinica.invalid`;
  const usuario = await contexto.prisma.usuario.create({
    data: {
      nome: `Usuario de teste ${marca}`,
      identificacao,
      senhaHash: await gerarHashSenha(SENHA),
      perfilId: perfil.id,
      unidadeId: UNIDADE_PADRAO,
    },
  });
  const resposta = await request(contexto.servidor)
    .post('/api/v1/auth/login')
    .send({ identificacao, senha: SENHA });
  const { accessToken } = resposta.body as { accessToken: string };
  return { token: accessToken, usuarioId: usuario.id, perfilId: perfil.id };
}
