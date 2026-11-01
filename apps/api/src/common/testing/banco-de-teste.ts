/** Único banco em que os testes de integração podem gravar e limpar dados. */
export const BANCO_DE_TESTE = 'filas_test';

/**
 * Aborta antes de qualquer `migrate reset` ou limpeza se a URL não apontar para `filas_test`,
 * para que um `.env` errado nunca apague o `filas_dev` (com o seed) de quem roda os testes.
 */
export function garantirBancoDeTeste(url: string | undefined): string {
  if (!url) {
    throw new Error(
      'URL do banco de teste não definida (DATABASE_URL_TEST, DIRECT_URL_TEST). Copie o .env.example para .env na raiz.',
    );
  }
  let banco: string;
  try {
    banco = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error('A URL do banco de teste não é uma URL válida do PostgreSQL.');
  }
  if (banco !== BANCO_DE_TESTE) {
    throw new Error(
      `Os testes de integração só rodam no banco ${BANCO_DE_TESTE}; a URL aponta para "${banco}".`,
    );
  }
  return url;
}
