import { type ButtonHTMLAttributes } from 'react';

export type ButtonVariante = 'primario' | 'secundario';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: ButtonVariante;
}

/**
 * Componente de exemplo do esqueleto do design system.
 * O design system completo (Tailwind + Radix, RNF-06) entra a partir da Etapa 3.
 */
export function Button({ variante = 'primario', type = 'button', ...props }: ButtonProps) {
  return <button type={type} data-variante={variante} {...props} />;
}
