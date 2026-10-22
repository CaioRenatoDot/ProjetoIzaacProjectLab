import Link from 'next/link';

import { ENTIDADES_CADASTRO, SLUGS_CADASTRO, type SlugCadastro } from '@/lib/cadastros/entidades';

/** Troca de entidade no módulo Cadastros ("Entidade: Paciente" no W-03). */
export function NavegacaoCadastros({ atual }: { atual: SlugCadastro }) {
  return (
    <nav aria-label="Entidades de cadastro">
      <ul className="flex flex-wrap gap-2">
        {SLUGS_CADASTRO.map((slug) => {
          const ativa = slug === atual;
          return (
            <li key={slug}>
              <Link
                href={`/cadastros/${slug}`}
                aria-current={ativa ? 'page' : undefined}
                className={`flex min-h-toque items-center rounded-md border px-3 ${ativa ? 'border-primaria bg-primaria text-texto-invertido' : 'border-borda text-texto hover:bg-superficie-hover'}`}
              >
                {ENTIDADES_CADASTRO[slug].titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
