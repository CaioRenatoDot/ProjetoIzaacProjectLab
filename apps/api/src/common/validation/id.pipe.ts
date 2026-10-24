import { type PipeTransform } from '@nestjs/common';

import { ErroDominio } from '../errors/erro-dominio';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `:id` que não é UUID não pode existir: responde 404, como um registro inexistente. */
export class IdPipe implements PipeTransform<string, string> {
  transform(valor: string): string {
    if (!UUID.test(valor)) {
      throw new ErroDominio(
        'NAO_ENCONTRADO',
        404,
        'Registro não encontrado',
        'O registro não existe ou foi removido.',
      );
    }
    return valor.toLowerCase();
  }
}
