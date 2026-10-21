import { type ButtonHTMLAttributes } from 'react';

export type ButtonVariante = 'primario' | 'secundario' | 'destrutivo';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: ButtonVariante;
}

const classeBase =
  'inline-flex min-h-toque min-w-toque items-center justify-center rounded-md px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria disabled:cursor-not-allowed disabled:opacity-50';

/** Ação destrutiva usa `destrutivo` (vermelho) e fica sempre à direita (especificação de UI §3.3). */
export const classesBotao: Record<ButtonVariante, string> = {
  primario: `${classeBase} bg-primaria text-texto-invertido hover:bg-primaria-hover`,
  secundario: `${classeBase} border border-borda bg-superficie text-texto hover:bg-superficie-elevada`,
  destrutivo: `${classeBase} bg-erro text-texto-invertido hover:bg-erro-hover`,
};

/** Botão com área de toque mínima de 44 x 44 px (especificação de UI §2.1). */
export function Button({
  variante = 'primario',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variante={variante}
      className={className ? `${classesBotao[variante]} ${className}` : classesBotao[variante]}
      {...props}
    />
  );
}
