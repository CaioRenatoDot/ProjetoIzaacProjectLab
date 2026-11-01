import { type ReactNode } from 'react';

/** Campo de formulário: borda com 3:1 de contraste, borda de erro com `aria-invalid`. */
export const classeCampo =
  'min-h-toque rounded-md border border-borda bg-superficie p-2 text-texto aria-invalid:border-2 aria-invalid:border-erro';

export interface ErroCampoProps {
  id: string;
  children: ReactNode;
}

/** Erro abaixo do campo, em vermelho e com ícone (especificação de UI §3.2). */
export function ErroCampo({ id, children }: ErroCampoProps) {
  return (
    <p id={id} className="flex items-start gap-1 text-erro">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </p>
  );
}
