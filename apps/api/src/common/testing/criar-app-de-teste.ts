import { type Server } from 'node:http';

import { type INestApplication, type ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { configurarApp, type OpcoesApp } from '../../configurar-app';

export interface AppDeTeste {
  app: INestApplication;
  servidor: Server;
}

/**
 * Monta a aplicação com a mesma configuração do main.ts (prefixo, X-Request-Id, filtro de
 * erros e CORS), para os testes HTTP exercitarem o comportamento real.
 * `ajustar` permite trocar providers (ex.: o PrismaService por um dublê).
 */
export async function criarAppDeTeste(
  metadata: ModuleMetadata,
  opcoes: OpcoesApp = {},
  ajustar: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<AppDeTeste> {
  const modulo = await ajustar(Test.createTestingModule(metadata)).compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarApp(app, opcoes);
  await app.init();
  return { app, servidor: app.getHttpServer() as Server };
}
