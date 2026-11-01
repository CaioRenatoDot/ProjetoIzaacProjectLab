/**
 * Tipos dos cadastros base: os mesmos de `@filas/contracts`, a fonte única do contrato
 * (`docs/api/openapi.yaml`). Reexportados aqui para as telas importarem de um lugar só.
 */
export type {
  Disponibilidade,
  Especialidade,
  Estudante,
  ItemReferencia,
  Paciente,
  RespostaPaginada as Pagina,
  Sala,
  Supervisor,
  Turno,
} from '@filas/contracts';
