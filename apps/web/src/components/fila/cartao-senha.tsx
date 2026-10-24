'use client';

import { type Prioridade } from '@filas/contracts';
import { Button, EtiquetaStatus } from '@filas/ui';
import { useEffect, useState } from 'react';

import {
  minutosDesde,
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_ATENDIMENTO,
  textoMinutos,
} from '@/lib/fila/quadro';
import { type SenhaResumo } from '@/lib/fila/tipos';

/**
 * Prioridade é atributo separado do status e nunca usa a cor dele (P-01): fundo escuro sólido,
 * enquanto as etiquetas de status usam fundo claro. "Normal" não recebe etiqueta.
 */
const CLASSE_PRIORIDADE: Record<Exclude<Prioridade, 'NORMAL'>, string> = {
  URGENTE: 'bg-red-800 text-white',
  PREFERENCIAL: 'bg-indigo-800 text-white',
};

export function EtiquetaPrioridade({ prioridade }: { prioridade: Prioridade }) {
  if (prioridade === 'NORMAL') return null;
  return (
    <span
      data-prioridade={prioridade}
      className={`inline-flex items-center rounded px-2 py-0.5 text-secundario font-semibold ${CLASSE_PRIORIDADE[prioridade]}`}
    >
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

/** Relógio do cronômetro: atualiza a cada 30 s, o suficiente para minutos. */
export function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

export interface CartaoSenhaProps {
  senha: SenhaResumo;
  agora: number;
  onAbrir: (senha: SenhaResumo) => void;
}

/**
 * Cartão de senha (T-09): número em destaque, prioridade à esquerda do número (P-01), iniciais,
 * especialidade, tipo, cronômetro em texto e status. Nunca conteúdo clínico (P-03). "Detalhes"
 * abre o painel lateral (W-08); o cartão é lido como região "Senha N103".
 */
export function CartaoSenha({ senha, agora, onAbrir }: CartaoSenhaProps) {
  const titulo = `senha-${senha.id}-titulo`;
  const espera = textoMinutos(minutosDesde(senha.chegadaEm, agora));

  return (
    <article
      aria-labelledby={titulo}
      data-sla-excedido={senha.slaExcedido || undefined}
      className={`flex flex-col gap-1 rounded-md bg-superficie p-3 ${senha.slaExcedido ? 'border-2 border-erro' : 'border border-borda-suave'}`}
    >
      <p className="flex flex-wrap items-center gap-2">
        <EtiquetaPrioridade prioridade={senha.prioridade} />
        <span id={titulo} className="text-secao font-semibold">
          <span className="sr-only">Senha</span> {senha.numero}
        </span>
      </p>
      <p>
        {senha.pacienteIniciais} · {senha.especialidade}
      </p>
      <p className="text-secundario text-texto-secundario">
        {ROTULO_TIPO_ATENDIMENTO[senha.tipoAtendimento]} · Espera: {espera}
      </p>
      {senha.slaExcedido && (
        <p className="flex items-center gap-1 text-secundario font-medium text-erro">
          <span aria-hidden="true">⚠</span> SLA excedido
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EtiquetaStatus status={senha.status} />
        <Button
          variante="secundario"
          aria-label={`Detalhes da senha ${senha.numero}`}
          aria-haspopup="dialog"
          onClick={() => onAbrir(senha)}
        >
          Detalhes
        </Button>
      </div>
    </article>
  );
}
