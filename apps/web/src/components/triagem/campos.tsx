import { ErroCampo } from '@filas/ui';
import { type ReactNode } from 'react';

export interface CampoProps {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  dica?: string;
  children: ReactNode;
}

/** Rótulo visível, dica e erro abaixo do campo (especificação de UI §3.2). O controle recebe `id`. */
export function Campo({ id, rotulo, obrigatorio, erro, dica, children }: CampoProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-texto">
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
      </label>
      {dica && (
        <p id={`${id}-dica`} className="text-secundario text-texto-secundario">
          {dica}
        </p>
      )}
      {children}
      {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
    </div>
  );
}

/** Atributos de acessibilidade do controle conforme dica e erro do campo. */
export function atributosCampo(id: string, { erro, dica }: { erro?: string; dica?: string }) {
  const descricao = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': descricao || undefined,
  } as const;
}
