/**
 * Rota de volta depois do login. Só aceita caminho interno (começa com `/`, não com `//` nem
 * `/\`), para evitar redirecionamento aberto; qualquer outro valor vai para a home.
 */
export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor?.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) return '/';
  if (valor === '/login' || valor.startsWith('/login?')) return '/';
  return valor;
}

/** `/login`, guardando a rota de destino e, se for o caso, o aviso de sessão expirada (T-01). */
export function urlLogin(destino: string, expirada = false): string {
  const parametros = new URLSearchParams();
  const rota = destinoSeguro(destino);
  if (rota !== '/') parametros.set('redirect', rota);
  if (expirada) parametros.set('expirada', '1');
  const consulta = parametros.toString();
  return consulta ? `/login?${consulta}` : '/login';
}
