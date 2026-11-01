'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useId, useRef, useState } from 'react';

import { Button } from './button.js';
import { classeCampo, ErroCampo } from './campo.js';

export interface ModalProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  telaCheiaNoCelular?: boolean;
  lateral?: boolean;
}

/**
 * Radix Dialog prende o foco no modal. Como os modais são controlados (sem Dialog.Trigger),
 * o elemento de origem é guardado na abertura e recebe o foco de volta ao fechar (RNF-06).
 */
export function Modal({
  aberto,
  onAbertoChange,
  titulo,
  descricao,
  children,
  telaCheiaNoCelular = false,
  lateral = false,
}: ModalProps) {
  const origem = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={aberto} onOpenChange={onAbertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-primaria/50" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            origem.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(evento) => {
            if (!origem.current?.isConnected) return;
            evento.preventDefault();
            origem.current.focus();
          }}
          className={
            lateral
              ? 'fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-4 overflow-y-auto border-l border-borda bg-superficie p-6 shadow-lg md:max-w-md'
              : telaCheiaNoCelular
                ? 'fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-superficie p-6 shadow-lg md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-2rem)] md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg'
                : 'fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-superficie p-6 shadow-lg'
          }
        >
          <Dialog.Title className="text-secao font-semibold text-texto">{titulo}</Dialog.Title>
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

export interface ModalConfirmacaoProps extends Omit<ModalProps, 'children'> {
  rotuloConfirmar?: string;
  destrutiva?: boolean;
  onConfirmar: () => void;
}

export function ModalConfirmacao({
  rotuloConfirmar = 'Confirmar',
  destrutiva = false,
  onConfirmar,
  ...props
}: ModalConfirmacaoProps) {
  return (
    <Modal {...props}>
      <div className="flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button variante="secundario">Cancelar</Button>
        </Dialog.Close>
        <Button variante={destrutiva ? 'destrutivo' : 'primario'} onClick={onConfirmar}>
          {rotuloConfirmar}
        </Button>
      </div>
    </Modal>
  );
}

export interface ModalJustificativaProps extends Omit<ModalProps, 'children'> {
  rotuloConfirmar?: string;
  rotuloCampo?: string;
  destrutiva?: boolean;
  /** Recebe o texto da justificativa, já sem espaços nas pontas. */
  onConfirmar: (justificativa: string) => void;
}

/** A justificativa vai no corpo da requisição e é copiada para o audit_log (docs/04 §8). */
export function ModalJustificativa({
  rotuloConfirmar = 'Confirmar',
  rotuloCampo = 'Justificativa',
  destrutiva = false,
  onConfirmar,
  onAbertoChange,
  ...props
}: ModalJustificativaProps) {
  const id = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function alterarAberto(aberto: boolean) {
    if (!aberto) {
      setTexto('');
      setErro(null);
    }
    onAbertoChange(aberto);
  }

  function confirmar() {
    const justificativa = texto.trim();
    if (!justificativa) {
      setErro('Informe a justificativa para continuar.');
      campo.current?.focus();
      return;
    }
    onConfirmar(justificativa);
  }

  return (
    <Modal {...props} onAbertoChange={alterarAberto}>
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium text-texto">
          {rotuloCampo}
        </label>
        <textarea
          id={id}
          ref={campo}
          rows={4}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={classeCampo}
        />
        {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
      </div>
      <div className="flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button variante="secundario">Cancelar</Button>
        </Dialog.Close>
        <Button variante={destrutiva ? 'destrutivo' : 'primario'} onClick={confirmar}>
          {rotuloConfirmar}
        </Button>
      </div>
    </Modal>
  );
}
