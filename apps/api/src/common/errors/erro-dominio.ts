import { type CampoInvalido, type CodigoErro } from '@filas/contracts';

/**
 * Erro que os services lançam para o cliente: código estável, status HTTP e mensagem pronta
 * para exibição (docs/04-contrato-api.md §4). O ProblemaFilter o converte em problem+json.
 */
export class ErroDominio extends Error {
  constructor(
    readonly codigo: CodigoErro,
    readonly status: number,
    readonly titulo: string,
    readonly detalhe?: string,
    /** Campos extras do corpo, por exemplo `recursoExistenteId` na duplicidade. */
    readonly extras: Record<string, unknown> = {},
  ) {
    super(detalhe ?? titulo);
    this.name = 'ErroDominio';
  }
}

/** Erro 422 com a lista de campos inválidos (schema `ProblemaValidacao`). */
export class ErroValidacao extends ErroDominio {
  constructor(campos: CampoInvalido[]) {
    super('VALIDACAO', 422, 'Dados inválidos', 'Revise os campos indicados e tente novamente.', {
      campos,
    });
  }
}
