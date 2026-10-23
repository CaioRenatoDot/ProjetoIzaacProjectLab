'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useRef } from 'react';

import { classesBotao } from './button.js';

export interface PainelLateralProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
}

/**
 * Painel lateral contextual (especificação de UI §2.4): à direita a partir de 1280 px e em tela
 * cheia abaixo disso (§3.5). Prende o foco como o modal e devolve o foco à origem ao fechar.
 */
export function PainelLateral({
  aberto,
  onAbertoChange,
  titulo,
  descricao,
  children,
}: PainelLateralProps) {
  const origem = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={aberto} onOpenChange={onAbertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-primaria/50" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            origem.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(evento) => {
            if (!origem.current?.isConnected) return;
            evento.preventDefault();
            origem.current.focus();
          }}
          className="fixed inset-0 flex flex-col gap-4 overflow-y-auto bg-superficie p-6 shadow-lg xl:left-auto xl:w-[28rem] xl:border-l xl:border-borda-suave"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-secao font-semibold text-texto">{titulo}</Dialog.Title>
            <Dialog.Close className={classesBotao.secundario}>Fechar</Dialog.Close>
          </div>
          {descricao ? (
            <Dialog.Description className="text-texto-secundario">{descricao}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
