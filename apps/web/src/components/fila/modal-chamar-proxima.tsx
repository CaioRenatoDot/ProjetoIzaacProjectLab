'use client';

import { type Prioridade } from '@filas/contracts';
import { Button, EstadoCarregando, EstadoErro, Modal } from '@filas/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { candidatosDoBloco, escolhaInicial, manterOuSugestao, temApto } from '@/lib/alocacao/api';
import { type RecursosChamada, type SugestoesChamada } from '@/lib/alocacao/tipos';
import { type FilaApi } from '@/lib/fila/api';
import { ROTULO_PRIORIDADE } from '@/lib/fila/quadro';
import { type Fila, type SenhaResumo } from '@/lib/fila/tipos';

import { BlocoAlocacaoRecurso } from '../alocacao/bloco-alocacao';

interface Escolhas {
  estudante: string | null;
  supervisor: string | null;
  sala: string | null;
}

const nomeEscolhido = (bloco: SugestoesChamada['sala'], id: string | null) =>
  candidatosDoBloco(bloco).find((c) => c.id === id)?.nome ?? null;

export interface ModalChamarProximaProps {
  api: FilaApi;
  fila: Fila;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  /** Próxima senha urgente que passa à frente (RN-03): o aviso fica no próprio modal. */
  urgente: SenhaResumo | null;
  onConfirmar: (recursos: RecursosChamada) => void;
  chamando: boolean;
  /** Recusa da chamada (ex.: recurso tomado por outra pessoa); as sugestões já foram recarregadas. */
  erro: string | null;
}

/**
 * "Chamar próxima" com os recursos (#149): estudante, supervisor (quando exigido) e sala são
 * escolhidos antes de a senha aparecer no telão, que passa a mostrar a sala. A prévia não reserva
 * nada; a API escolhe a senha pela RN-04 e revalida os recursos na mesma transação da chamada.
 * Sem recurso apto em algum bloco, não há chamada: a senha continua aguardando.
 */
export function ModalChamarProxima({
  api,
  fila,
  aberto,
  onAbertoChange,
  urgente,
  onConfirmar,
  chamando,
  erro,
}: ModalChamarProximaProps) {
  const sugestoes = useQuery({
    queryKey: ['fila', 'sugestoes-chamada', fila.id],
    queryFn: () => api.sugestoesChamada(fila.id),
    enabled: aberto,
    staleTime: 0,
    retry: false,
  });

  return (
    <Modal
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      lateral
      titulo={`Chamar próxima senha · ${fila.especialidade}`}
      descricao="Confira os recursos antes de chamar: o telão mostra a senha e a sala."
    >
      {sugestoes.isPending ? (
        <EstadoCarregando linhas={5} rotulo="Carregando os recursos disponíveis" />
      ) : sugestoes.isError ? (
        <EstadoErro
          mensagem="Não foi possível carregar os recursos disponíveis. Verifique a conexão e tente novamente."
          onTentarNovamente={() => void sugestoes.refetch()}
        />
      ) : (
        <Formulario
          sugestoes={sugestoes.data}
          especialidade={fila.especialidade}
          urgente={urgente}
          onCancelar={() => onAbertoChange(false)}
          onConfirmar={onConfirmar}
          chamando={chamando}
          erro={erro}
        />
      )}
    </Modal>
  );
}

function Formulario({
  sugestoes,
  especialidade,
  urgente,
  onCancelar,
  onConfirmar,
  chamando,
  erro,
}: {
  sugestoes: SugestoesChamada;
  especialidade: string;
  urgente: SenhaResumo | null;
  onCancelar: () => void;
  onConfirmar: (recursos: RecursosChamada) => void;
  chamando: boolean;
  erro: string | null;
}) {
  const idPendencia = useId();
  const alerta = useRef<HTMLDivElement>(null);
  const comSupervisor = sugestoes.supervisor.aplicavel;
  const [escolhas, setEscolhas] = useState<Escolhas>(() => ({
    estudante: escolhaInicial(sugestoes.estudante),
    supervisor: comSupervisor ? escolhaInicial(sugestoes.supervisor) : null,
    sala: escolhaInicial(sugestoes.sala),
  }));

  // Sugestões recarregadas depois de uma recusa: escolha que ficou inapta volta para a sugestão.
  useEffect(() => {
    setEscolhas((anterior) => ({
      estudante: manterOuSugestao(anterior.estudante, sugestoes.estudante),
      supervisor: comSupervisor
        ? manterOuSugestao(anterior.supervisor, sugestoes.supervisor)
        : null,
      sala: manterOuSugestao(anterior.sala, sugestoes.sala),
    }));
  }, [sugestoes, comSupervisor]);

  useEffect(() => {
    if (erro) alerta.current?.focus();
  }, [erro]);

  const faltando = [
    !temApto(sugestoes.estudante) && 'estudante',
    comSupervisor && !temApto(sugestoes.supervisor) && 'supervisor',
    !temApto(sugestoes.sala) && 'sala',
  ].filter(Boolean) as string[];
  const pendentes = [
    !escolhas.estudante && 'estudante',
    comSupervisor && !escolhas.supervisor && 'supervisor',
    !escolhas.sala && 'sala',
  ].filter(Boolean) as string[];
  const { proxima } = sugestoes;
  const bloqueado = !proxima || faltando.length > 0 || pendentes.length > 0 || chamando;
  const sala = nomeEscolhido(sugestoes.sala, escolhas.sala);

  return (
    <div className="flex flex-col gap-4">
      <p>
        {proxima ? (
          <>
            Próxima pela ordem da fila: <strong>{proxima.numero}</strong> (
            {ROTULO_PRIORIDADE[proxima.prioridade as Prioridade] ?? proxima.prioridade}).
          </>
        ) : (
          'Nenhuma senha aguardando nesta fila.'
        )}
      </p>

      {urgente && (
        <p className="flex items-start gap-1 rounded-md bg-alerta-fundo p-3 text-alerta-texto">
          <span aria-hidden="true">⚠</span>
          <span>
            A próxima senha, {urgente.numero}, é urgente e passa à frente de senhas que chegaram
            antes. A ordem padrão é alterada por urgência clínica (RN-03).
          </span>
        </p>
      )}

      {erro && (
        <div
          ref={alerta}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-1 rounded-md border-2 border-erro p-3 text-erro"
        >
          <span aria-hidden="true">⚠</span>
          <span>{erro}</span>
        </div>
      )}

      {faltando.length > 0 && (
        <p role="alert" className="rounded-md border-2 border-erro p-3 text-erro">
          Sem {faltando.join(', ')} apto agora: a senha não é chamada e continua aguardando na fila.
          O motivo de cada um está na lista abaixo.
        </p>
      )}

      <BlocoAlocacaoRecurso
        titulo="1 · Estudante/atendente"
        nenhum="Nenhum estudante"
        bloco={sugestoes.estudante}
        escolhido={escolhas.estudante}
        onEscolher={(id) => setEscolhas((e) => ({ ...e, estudante: id }))}
        desabilitado={chamando}
      />
      {comSupervisor && (
        <BlocoAlocacaoRecurso
          titulo="2 · Supervisor"
          nenhum="Nenhum supervisor"
          bloco={sugestoes.supervisor}
          escolhido={escolhas.supervisor}
          onEscolher={(id) => setEscolhas((e) => ({ ...e, supervisor: id }))}
          desabilitado={chamando}
        />
      )}
      <BlocoAlocacaoRecurso
        titulo={comSupervisor ? '3 · Sala' : '2 · Sala'}
        nenhum="Nenhuma sala"
        bloco={sugestoes.sala}
        escolhido={escolhas.sala}
        onEscolher={(id) => setEscolhas((e) => ({ ...e, sala: id }))}
        desabilitado={chamando}
      />
      {!comSupervisor && (
        <p className="text-texto-secundario">
          {especialidade} não exige supervisão docente (RN-07).
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-borda-suave pt-3">
        {sala && (
          <p>
            <span className="font-medium">No telão:</span> senha e {sala}.
          </p>
        )}
        {pendentes.length > 0 && faltando.length === 0 && (
          <p id={idPendencia} className="text-texto-secundario">
            Escolha {pendentes.join(', ')} para chamar.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            disabled={bloqueado}
            aria-describedby={
              pendentes.length > 0 && faltando.length === 0 ? idPendencia : undefined
            }
            aria-busy={chamando}
            onClick={() =>
              onConfirmar({
                estudanteId: escolhas.estudante ?? '',
                supervisorId: comSupervisor ? escolhas.supervisor : null,
                salaId: escolhas.sala ?? '',
              })
            }
          >
            {chamando ? 'Chamando…' : 'Confirmar e chamar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
