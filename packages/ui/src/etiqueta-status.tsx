import { type StatusSenha } from '@filas/contracts';
import { type HTMLAttributes } from 'react';

export interface ApresentacaoStatus {
  rotulo: string;
  /** Cor de apoio (fundo claro + borda). Texto escuro sobre o fundo, contraste >= 4.5:1. */
  classes: string;
}

/**
 * Rótulo e cor de apoio de cada status (Documento de Requisitos, Apêndice A §4, P-01).
 * `Record<StatusSenha, ...>`: um status novo no enum sem entrada aqui quebra o typecheck.
 */
export const APRESENTACAO_STATUS: Record<StatusSenha, ApresentacaoStatus> = {
  AGUARDANDO: {
    rotulo: 'Aguardando',
    classes: 'border-slate-500 bg-slate-100 text-slate-900',
  },
  CHAMADA: {
    rotulo: 'Chamada',
    classes: 'border-blue-600 bg-blue-100 text-blue-900',
  },
  AGUARDANDO_RECURSO: {
    rotulo: 'Aguardando recurso',
    classes: 'border-amber-600 bg-amber-100 text-amber-950',
  },
  EM_ATENDIMENTO: {
    rotulo: 'Em atendimento',
    classes: 'border-green-700 bg-green-100 text-green-900',
  },
  PAUSADO: {
    rotulo: 'Pausado',
    classes: 'border-amber-600 bg-amber-100 text-amber-950',
  },
  PENDENTE_VALIDACAO: {
    rotulo: 'Pendente de validação',
    classes: 'border-purple-600 bg-purple-100 text-purple-900',
  },
  ENCERRADO: {
    rotulo: 'Encerrado',
    classes: 'border-gray-400 bg-gray-100 text-gray-800',
  },
  AUSENTE: {
    rotulo: 'Ausente',
    classes: 'border-red-600 bg-red-100 text-red-900',
  },
  DESISTENCIA: {
    rotulo: 'Desistência',
    classes: 'border-gray-800 bg-gray-700 text-white',
  },
};

const classeBase =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-secundario font-medium whitespace-nowrap';

export interface EtiquetaStatusProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: StatusSenha;
}

/** Etiqueta de status da senha: rótulo textual sempre visível; a cor é só reforço (RNF-06). */
export function EtiquetaStatus({ status, className, ...props }: EtiquetaStatusProps) {
  const { rotulo, classes } = APRESENTACAO_STATUS[status];
  const classe = `${classeBase} ${classes}`;
  return (
    <span data-status={status} className={className ? `${classe} ${className}` : classe} {...props}>
      {rotulo}
    </span>
  );
}
