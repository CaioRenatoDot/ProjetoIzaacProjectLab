/** Marcação distinta da consulta a dado de prontuário (RNF-07): texto e símbolo, além da cor. */
export function MarcaSensivel() {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-purple-700 bg-purple-100 px-2.5 py-0.5 text-secundario font-medium whitespace-nowrap text-purple-900">
      <span aria-hidden="true">◆</span>
      Consulta sensível
    </span>
  );
}
