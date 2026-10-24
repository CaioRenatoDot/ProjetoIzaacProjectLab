import { redirect } from 'next/navigation';

interface PaginaModuloAlocacaoProps {
  searchParams: Promise<{ senha?: string | string[] }>;
}

/**
 * Módulo "Alocação" do menu. A alocação parte de uma senha chamada no painel de fila (UC-10):
 * com `?senha=<id>`, abre a alocação dela; sem senha, vai para a fila.
 */
export default async function PaginaModuloAlocacao({ searchParams }: PaginaModuloAlocacaoProps) {
  const { senha } = await searchParams;
  const id = Array.isArray(senha) ? senha[0] : senha;
  redirect(id ? `/fila/senhas/${encodeURIComponent(id)}/alocacao` : '/fila');
}
