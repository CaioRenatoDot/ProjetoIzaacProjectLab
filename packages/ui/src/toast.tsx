'use client';

import * as RadixToast from '@radix-ui/react-toast';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

export type ToastTipo = 'sucesso' | 'info' | 'erro';

export interface ToastOpcoes {
  mensagem: string;
  tipo?: ToastTipo;
  /** Erro irreversível não some sozinho: exige fechar (especificação de UI §3.2). */
  irreversivel?: boolean;
}

interface ToastItem extends Required<ToastOpcoes> {
  id: number;
}

/** Duração padrão de 5 s. */
export const DURACAO_TOAST_MS = 5000;

const ToastContext = createContext<((opcoes: ToastOpcoes) => void) | null>(null);

const classePorTipo: Record<ToastTipo, string> = {
  sucesso: 'border-sucesso',
  info: 'border-borda',
  erro: 'border-erro',
};

let proximoId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const mostrar = useCallback((opcoes: ToastOpcoes) => {
    proximoId += 1;
    const item: ToastItem = { tipo: 'info', irreversivel: false, ...opcoes, id: proximoId };
    setToasts((atuais) => [...atuais, item]);
  }, []);

  function remover(id: number) {
    setToasts((atuais) => atuais.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={mostrar}>
      <RadixToast.Provider label="Notificação" duration={DURACAO_TOAST_MS}>
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            type={t.tipo === 'erro' ? 'foreground' : 'background'}
            duration={t.irreversivel ? Infinity : DURACAO_TOAST_MS}
            onOpenChange={(aberto) => !aberto && remover(t.id)}
            className={`flex items-start gap-3 rounded-md border-l-4 bg-superficie p-4 shadow-lg ${classePorTipo[t.tipo]}`}
          >
            <RadixToast.Description className="flex-1 text-texto">
              {t.mensagem}
            </RadixToast.Description>
            <RadixToast.Close
              aria-label="Fechar notificação"
              className="inline-flex min-h-toque min-w-toque items-center justify-center rounded text-texto-secundario hover:bg-superficie-elevada"
            >
              ×
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport
          label="Notificações ({hotkey})"
          className="fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100%-2rem)] flex-col gap-2"
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const mostrar = useContext(ToastContext);
  if (!mostrar) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return mostrar;
}
