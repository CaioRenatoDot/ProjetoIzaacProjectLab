'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useId, useRef, useState } from 'react';

import { Button } from './button.js';

const classeBotaoSecundario =
  'rounded-md border border-slate-400 px-4 py-2 text-slate-900 hover:bg-slate-100';
const classeBotaoPrimario = 'rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700';
/** Ação destrutiva: vermelho, sempre à direita (especificação de UI §3.3). */
const classeBotaoDestrutivo = 'rounded-md bg-red-700 px-4 py-2 text-white hover:bg-red-800';

interface ModalBaseProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
}

/**
 * Radix Dialog prende o foco no modal. Como os modais são controlados (sem Dialog.Trigger),
 * o elemento de origem é guardado na abertura e recebe o foco de volta ao fechar (RNF-06).
 */
function ModalBase({ aberto, onAbertoChange, titulo, descricao, children }: ModalBaseProps) {
  const origem = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={aberto} onOpenChange={onAbertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/50" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            origem.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(evento) => {
            if (!origem.current?.isConnected) return;
            evento.preventDefault();
            origem.current.focus();
          }}
          className="fixed top-1/2 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-white p-6 shadow-lg"
        >
          <Dialog.Title className="text-lg font-semibold text-slate-900">{titulo}</Dialog.Title>
          {descricao ? (
            <Dialog.Description className="text-slate-700">{descricao}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ModalConfirmacaoProps extends Omit<ModalBaseProps, 'children'> {
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
    <ModalBase {...props}>
      <div className="flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button className={classeBotaoSecundario}>Cancelar</Button>
        </Dialog.Close>
        <Button
          className={destrutiva ? classeBotaoDestrutivo : classeBotaoPrimario}
          onClick={onConfirmar}
        >
          {rotuloConfirmar}
        </Button>
      </div>
    </ModalBase>
  );
}

export interface ModalJustificativaProps extends Omit<ModalBaseProps, 'children'> {
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
      return;
    }
    onConfirmar(justificativa);
  }

  return (
    <ModalBase {...props} onAbertoChange={alterarAberto}>
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium text-slate-900">
          {rotuloCampo}
        </label>
        <textarea
          id={id}
          rows={4}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className="rounded-md border border-slate-400 p-2 text-slate-900"
        />
        {erro && (
          <p id={`${id}-erro`} className="text-red-700">
            {erro}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button className={classeBotaoSecundario}>Cancelar</Button>
        </Dialog.Close>
        <Button
          className={destrutiva ? classeBotaoDestrutivo : classeBotaoPrimario}
          onClick={confirmar}
        >
          {rotuloConfirmar}
        </Button>
      </div>
    </ModalBase>
  );
}
