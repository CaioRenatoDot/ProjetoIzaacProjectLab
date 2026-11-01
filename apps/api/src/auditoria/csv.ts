/** Célula começando com estes caracteres vira fórmula ao abrir o CSV numa planilha. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

/** Escapa a célula para CSV separado por ponto e vírgula, neutralizando fórmulas. */
export function celulaCsv(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  if (INICIO_DE_FORMULA.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function linhaCsv(celulas: (string | number | boolean | null | undefined)[]): string {
  return celulas.map(celulaCsv).join(';');
}
