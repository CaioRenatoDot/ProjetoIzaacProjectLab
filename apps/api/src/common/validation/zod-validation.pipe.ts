import { type PipeTransform } from '@nestjs/common';
import { type z } from 'zod';

import { ErroValidacao } from '../errors/erro-dominio';

/**
 * Valida corpo, query ou parâmetro com um schema de `packages/contracts`
 * (`@Body(new ZodValidationPipe(Schema))`). Falha vira 422 VALIDACAO com `campos[]`,
 * usando o mesmo nome do campo enviado para o front ligar a mensagem ao campo.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown): z.output<T> {
    const resultado = this.schema.safeParse(valor);
    if (resultado.success) {
      return resultado.data;
    }
    throw new ErroValidacao(
      resultado.error.issues.map((issue) => ({
        campo: issue.path.map(String).join('.'),
        mensagem: issue.message,
      })),
    );
  }
}
