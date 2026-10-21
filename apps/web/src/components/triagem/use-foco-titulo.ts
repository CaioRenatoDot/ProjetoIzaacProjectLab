import { useEffect, useRef } from 'react';

/** Mudança de etapa move o foco para o título, para o leitor de tela anunciar a nova etapa. */
export function useFocoNoTitulo<T extends HTMLElement = HTMLHeadingElement>() {
  const titulo = useRef<T>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  return titulo;
}
