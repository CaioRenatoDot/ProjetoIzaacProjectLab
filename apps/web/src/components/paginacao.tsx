import { Button } from '@filas/ui';

import { type Pagina } from '@/lib/cadastros/tipos';

/** Paginação das listagens (`docs/04-contrato-api.md` §5), a partir do `meta` da resposta. */
export function Paginacao({
  pagina,
  onIr,
}: {
  pagina: Pagina<unknown>['meta'];
  onIr: (pagina: number) => void;
}) {
  const inicio = (pagina.pagina - 1) * pagina.tamanho + 1;
  const fim = Math.min(pagina.pagina * pagina.tamanho, pagina.total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
      <p className="text-texto-secundario">
        Mostrando {inicio}–{fim} de {pagina.total}
      </p>
      <nav aria-label="Paginação" className="flex items-center gap-3">
        <Button
          variante="secundario"
          disabled={pagina.pagina <= 1}
          onClick={() => onIr(pagina.pagina - 1)}
        >
          Anterior
        </Button>
        <span aria-current="page">
          Página {pagina.pagina} de {pagina.totalPaginas}
        </span>
        <Button
          variante="secundario"
          disabled={pagina.pagina >= pagina.totalPaginas}
          onClick={() => onIr(pagina.pagina + 1)}
        >
          Próxima
        </Button>
      </nav>
    </div>
  );
}
