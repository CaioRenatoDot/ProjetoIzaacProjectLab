import { type ReactNode } from 'react';

import { Button } from './button.js';

/** Os quatro estados obrigatórios de tela (especificação de UI §3.1). */

export interface EstadoCarregandoProps {
  /** Quantidade de linhas do esqueleto. */
  linhas?: number;
  rotulo?: string;
}

export function EstadoCarregando({ linhas = 3, rotulo = 'Carregando' }: EstadoCarregandoProps) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 py-4">
      <span className="sr-only">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-4 animate-pulse rounded bg-slate-200" />
      ))}
    </div>
  );
}

export interface EstadoVazioProps {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}

export function EstadoVazio({ titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-lg font-semibold text-slate-900">{titulo}</p>
      {descricao && <p className="text-slate-700">{descricao}</p>}
      {acao}
    </div>
  );
}

export interface EstadoErroProps {
  /** Causa e próximo passo, nunca apenas "erro" (especificação de UI §3.2). */
  mensagem: string;
  onTentarNovamente: () => void;
}

export function EstadoErro({ mensagem, onTentarNovamente }: EstadoErroProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-slate-900">{mensagem}</p>
      <Button
        onClick={onTentarNovamente}
        className="rounded-md border border-slate-400 px-4 py-2 text-slate-900 hover:bg-slate-100"
      >
        Tentar novamente
      </Button>
    </div>
  );
}

/**
 * Mensagem neutra: não revela se existe dado nem quanto (docs/04-contrato-api.md §3).
 * Não recebe props de propósito, para que nenhuma tela personalize o texto.
 */
export function EstadoSemPermissao() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-lg font-semibold text-slate-900">Acesso não permitido</p>
      <p className="text-slate-700">
        Seu perfil não tem acesso a este conteúdo. Se precisar dele, procure a administração da
        unidade.
      </p>
    </div>
  );
}
