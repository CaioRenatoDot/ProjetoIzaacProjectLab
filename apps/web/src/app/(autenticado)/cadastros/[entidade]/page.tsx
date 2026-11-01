import { notFound } from 'next/navigation';

import { ListaCadastro } from '@/components/cadastros/lista-cadastro';
import { SLUGS_CADASTRO, type SlugCadastro } from '@/lib/cadastros/entidades';

interface PaginaListaCadastroProps {
  params: Promise<{ entidade: string }>;
}

/** W-03: `/cadastros/pacientes`, `/estudantes`, `/supervisores`, `/salas` e `/especialidades`. */
export default async function PaginaListaCadastro({ params }: PaginaListaCadastroProps) {
  const { entidade } = await params;
  if (!(SLUGS_CADASTRO as string[]).includes(entidade)) notFound();
  return <ListaCadastro slug={entidade as SlugCadastro} />;
}

export function generateStaticParams() {
  return SLUGS_CADASTRO.map((entidade) => ({ entidade }));
}
