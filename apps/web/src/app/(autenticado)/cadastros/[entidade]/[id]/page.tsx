import { notFound } from 'next/navigation';

import { TelaFormularioCadastro } from '@/components/cadastros/formulario-cadastro';
import { SLUGS_CADASTRO, type SlugCadastro } from '@/lib/cadastros/entidades';

interface PaginaEditarCadastroProps {
  params: Promise<{ entidade: string; id: string }>;
}

/** W-04, edição. */
export default async function PaginaEditarCadastro({ params }: PaginaEditarCadastroProps) {
  const { entidade, id } = await params;
  if (!(SLUGS_CADASTRO as string[]).includes(entidade)) notFound();
  return <TelaFormularioCadastro slug={entidade as SlugCadastro} id={id} />;
}
