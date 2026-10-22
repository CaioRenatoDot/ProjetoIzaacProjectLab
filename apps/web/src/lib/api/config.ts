/** Base da API (`docs/04-contrato-api.md` §1). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

/**
 * Simulação da API com MSW (`docs/02` §5). Ligada por padrão em desenvolvimento, para as telas
 * funcionarem antes do back; `NEXT_PUBLIC_API_MOCK=false` usa a API real.
 */
export const USAR_MOCK =
  process.env.NEXT_PUBLIC_API_MOCK === 'true' ||
  (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_API_MOCK !== 'false');
