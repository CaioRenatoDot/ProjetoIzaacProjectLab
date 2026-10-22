/** Prefixo das chaves de `sessionStorage` que pertencem à sessão (aviso de consulta, filtros). */
export const PREFIXO_ESTADO_LOCAL = 'filas-';

/** Apaga o estado local da sessão anterior. A sessão chama ao entrar e ao sair. */
export function limparEstadoLocal() {
  try {
    const chaves = Array.from({ length: window.sessionStorage.length }, (_, i) =>
      window.sessionStorage.key(i),
    );
    for (const chave of chaves) {
      if (chave?.startsWith(PREFIXO_ESTADO_LOCAL)) window.sessionStorage.removeItem(chave);
    }
  } catch {
    // Sem storage disponível, não há o que apagar.
  }
}
