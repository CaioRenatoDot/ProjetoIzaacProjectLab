import { type Type } from '@nestjs/common';
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { AppModule } from '../../app.module';
import { CHAVE_AUTENTICADO, CHAVE_PUBLICO, CHAVE_REQUER } from './decorators';

type ItemModulo = Type | { module: Type; controllers?: Type[]; imports?: ItemModulo[] };

function controllersDe(item: ItemModulo, vistos = new Set<unknown>()): Type[] {
  const modulo = 'module' in item ? item.module : item;
  if (vistos.has(modulo)) return [];
  vistos.add(modulo);
  const lista = (chave: string) =>
    (Reflect.getMetadata(chave, modulo) as ItemModulo[] | undefined) ?? [];
  const extras = 'module' in item ? item : { controllers: [], imports: [] };
  const controllers = [
    ...(lista(MODULE_METADATA.CONTROLLERS) as Type[]),
    ...(extras.controllers ?? []),
  ];
  const imports = [...lista(MODULE_METADATA.IMPORTS), ...(extras.imports ?? [])];
  return [...controllers, ...imports.flatMap((importado) => controllersDe(importado, vistos))];
}

const temDecorator = (alvo: object) =>
  [CHAVE_REQUER, CHAVE_PUBLICO, CHAVE_AUTENTICADO].some(
    (chave) => Reflect.getMetadata(chave, alvo) !== undefined,
  );

describe('cobertura de autorização (docs/04 §3)', () => {
  it('toda rota da API tem @Requer, @Publico ou @Autenticado', () => {
    const scanner = new MetadataScanner();
    const semDecorator: string[] = [];
    let rotas = 0;

    for (const controller of controllersDe(AppModule)) {
      // getAllMethodNames ignora o construtor, que tem o metadado de rota do próprio @Controller.
      for (const metodo of scanner.getAllMethodNames(controller.prototype as object)) {
        const handler = (controller.prototype as Record<string, object>)[metodo]!;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        rotas += 1;
        if (!temDecorator(handler) && !temDecorator(controller)) {
          semDecorator.push(`${controller.name}.${metodo}`);
        }
      }
    }

    expect(rotas).toBeGreaterThan(0);
    expect(semDecorator).toEqual([]);
  });
});
