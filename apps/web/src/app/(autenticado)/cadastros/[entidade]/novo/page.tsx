import { notFound } from 'next/navigation';

import { TelaFormularioCadastro } from '@/components/cadastros/formulario-cadastro';
import { SLUGS_CADASTRO, type SlugCadastro } from '@/lib/cadastros/entidades';

interface PaginaNovoCadastroProps {
  params: Promise<{ entidade: string }>;
  searchParams: Promise<{ voltar?: string | string[] }>;
}

/** W-04, criação. `?voltar=/triagem` volta para a triagem depois de salvar (UC-05). */
export default async function PaginaNovoCadastro({
  params,
  searchParams,
}: PaginaNovoCadastroProps) {
  const { entidade } = await params;
  if (!(SLUGS_CADASTRO as string[]).includes(entidade)) notFound();
  const { voltar } = await searchParams;
  return (
    <TelaFormularioCadastro
      slug={entidade as SlugCadastro}
      voltar={Array.isArray(voltar) ? voltar[0] : voltar}
    />
  );
}
