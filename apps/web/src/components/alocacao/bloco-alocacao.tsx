'use client';

import { useId } from 'react';

import { candidatosDoBloco, temApto } from '@/lib/alocacao/api';
import { type BlocoAlocacao } from '@/lib/alocacao/tipos';

export interface BlocoAlocacaoProps {
  /** "1 · Estudante/atendente" etc. (W-11). */
  titulo: string;
  /** Início do aviso sem recurso apto, com o gênero certo: "Nenhum estudante", "Nenhuma sala". */
  nenhum: string;
  bloco: BlocoAlocacao;
  escolhido: string | null;
  onEscolher: (id: string) => void;
  desabilitado: boolean;
}

/**
 * Um bloco de W-11 (`fieldset` e legenda, T-10): sugestão e alternativas como opções. O que está
 * apto e o motivo de quem não está vêm da API; o motivo fica no texto do item, não em tooltip.
 * "Trocar recurso" é escolher outra opção apta.
 */
export function BlocoAlocacaoRecurso({
  titulo,
  nenhum,
  bloco,
  escolhido,
  onEscolher,
  desabilitado,
}: BlocoAlocacaoProps) {
  const nome = useId();
  const candidatos = candidatosDoBloco(bloco);
  const semApto = !temApto(bloco);

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-borda-suave p-4">
      <legend className="px-1 text-secao font-semibold">{titulo}</legend>
      <p className="text-secundario text-texto-secundario">
        Regras verificadas: {bloco.regrasVerificadas.join(', ') || '—'}.{' '}
        {!semApto && 'Para trocar, escolha outra opção apta.'}
      </p>

      {semApto && (
        <p className="flex items-start gap-1 rounded-md bg-alerta-fundo p-3 text-alerta-texto">
          <span aria-hidden="true">⚠</span>
          <span>{nenhum} disponível e compatível. Mantenha a senha aguardando recurso.</span>
        </p>
      )}

      {candidatos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {candidatos.map((candidato) => {
            const sugerido = bloco.sugestao?.id === candidato.id;
            return (
              <li key={candidato.id}>
                <label
                  className={`flex min-h-toque items-start gap-3 rounded-md border p-3 ${escolhido === candidato.id ? 'border-2 border-primaria' : 'border-borda-suave'} ${candidato.apto ? 'cursor-pointer hover:bg-superficie-hover' : 'bg-superficie-elevada'}`}
                >
                  <input
                    type="radio"
                    name={nome}
                    value={candidato.id}
                    checked={escolhido === candidato.id}
                    disabled={!candidato.apto || desabilitado}
                    onChange={() => onEscolher(candidato.id)}
                    className="mt-1 size-5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {candidato.nome}
                      {sugerido && (
                        <span className="font-normal text-texto-secundario"> (sugestão)</span>
                      )}
                    </span>
                    <span className="text-secundario text-texto-secundario">
                      {candidato.descricao}
                    </span>
                    <span
                      className={`text-secundario font-medium ${candidato.apto ? 'text-sucesso' : 'text-erro'}`}
                    >
                      {candidato.apto
                        ? 'Apto'
                        : `Inapto: ${candidato.motivoTexto ?? 'indisponível'}`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
