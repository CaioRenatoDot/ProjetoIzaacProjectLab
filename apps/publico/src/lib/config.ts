export const SIMULACAO_PUBLICA =
  process.env.NEXT_PUBLIC_API_MOCK === 'true' ||
  (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_API_MOCK !== 'false');

export const CONFIG_PUBLICA = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3333',
  unidadeId:
    process.env.NEXT_PUBLIC_UNIDADE_ID ?? (SIMULACAO_PUBLICA ? 'unidade-demonstracao' : ''),
  unidadeNome: process.env.NEXT_PUBLIC_UNIDADE_NOME ?? 'Clínica-Escola',
};
