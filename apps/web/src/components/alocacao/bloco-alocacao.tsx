'use client';

import { Button } from '@filas/ui';
import { useId } from 'react';

import { candidatosDoBloco, temApto } from '@/lib/alocacao/api';
import { type BlocoAlocacao, type CandidatoAlocacao } from '@/lib/alocacao/tipos';

export interface BlocoAlocacaoProps {
  /** "1 · Estudante/atendente" etc. (W-11). */
  titulo: string;
  /** Início do aviso sem recurso apto, com o gênero certo: "Nenhum estudante", "Nenhuma sala". */
  nenhum: string;
  bloco: BlocoAlocacao;
  escolhido: string | null;
  onEscolher: (id: string) => void;
  desabilitado: boolean;
  /** Sem recurso apto no bloco: oferece manter a senha aguardando este recurso (T-10). */
  onManterAguardando?: () => void;
}

/**
 * Um bloco de W-11 (`fieldset` e legenda, T-10): a sugestão do sistema em destaque, já escolhida,
 * e as alternativas logo abaixo, todas no mesmo grupo de opções (setas do teclado trocam a
 * escolha). O que está apto, o motivo de quem não está e qual é a sugestão vêm da API: a tela não
 * reordena nem recalcula. O motivo fica no texto do item, não em tooltip.
 */
export function BlocoAlocacaoRecurso({
  titulo,
  nenhum,
  bloco,
  escolhido,
  onEscolher,
  desabilitado,
  onManterAguardando,
}: BlocoAlocacaoProps) {
  const nome = useId();
  const candidatos = candidatosDoBloco(bloco);
  const semApto = !temApto(bloco);
  const sugestao = bloco.sugestao?.apto ? bloco.sugestao : null;
  const alternativas = sugestao ? candidatos.filter((c) => c.id !== sugestao.id) : candidatos;

  const opcao = (candidato: CandidatoAlocacao, sugerido: boolean) => (
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
        <span className="font-medium">{candidato.nome}</span>
        {sugerido && (
          <span className="w-fit rounded-sm bg-primaria px-1 text-secundario font-medium text-texto-invertido">
            Sugestão do sistema
          </span>
        )}
        <span className="text-secundario text-texto-secundario">{candidato.descricao}</span>
        <span
          className={`text-secundario font-medium ${candidato.apto ? 'text-sucesso' : 'text-erro'}`}
        >
          {candidato.apto ? 'Apto' : `Inapto: ${candidato.motivoTexto ?? 'indisponível'}`}
        </span>
      </span>
    </label>
  );

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-borda-suave p-4">
      <legend className="px-1 text-secao font-semibold">{titulo}</legend>
      <p className="text-secundario text-texto-secundario">
        Regras verificadas: {bloco.regrasVerificadas.join(', ') || '—'}.{' '}
        {!semApto && 'Para trocar a sugestão, escolha outra opção apta.'}
      </p>

      {semApto && (
        <div className="flex flex-col items-start gap-2 rounded-md bg-alerta-fundo p-3 text-alerta-texto">
          <p className="flex items-start gap-1">
            <span aria-hidden="true">⚠</span>
            <span>
              {nenhum} disponível e compatível, por isso não há sugestão.
              {candidatos.length > 0 && ' O motivo de cada um está na lista abaixo.'} Mantenha a
              senha aguardando recurso.
            </span>
          </p>
          {onManterAguardando && (
            <Button variante="secundario" disabled={desabilitado} onClick={onManterAguardando}>
              Manter aguardando recurso
            </Button>
          )}
        </div>
      )}

      {sugestao && opcao(sugestao, true)}

      {alternativas.length > 0 && (
        <div className="flex flex-col gap-2">
          {sugestao && <p className="font-medium">Alternativas</p>}
          <ul className="flex flex-col gap-2">
            {alternativas.map((candidato) => (
              <li key={candidato.id}>{opcao(candidato, false)}</li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}
