'use client';

import { Button, classeCampo, Modal, useConexao, useToast } from '@filas/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { formatarHorario, ROTULO_ACAO, ROTULO_BOTAO_ACAO } from '@/lib/alertas/apresentacao';
import { type AcaoEscalonamento, type Alerta, type Escalonamento } from '@/lib/alertas/tipos';
import { useSessao } from '@/lib/sessao/sessao';

export interface PedidoEscalonamento {
  alerta: Alerta;
  acao: AcaoEscalonamento;
}

export interface ModalEscalonamentoProps {
  pedido: PedidoEscalonamento | null;
  onFechar: () => void;
}

/** Confirma a medida de escalonamento (UC-19, fluxo alternativo); autor e horário ficam registrados. */
export function ModalEscalonamento({ pedido, onFechar }: ModalEscalonamentoProps) {
  return (
    <Modal
      aberto={pedido !== null}
      onAbertoChange={(aberto) => !aberto && onFechar()}
      titulo={pedido ? `${ROTULO_BOTAO_ACAO[pedido.acao]} em ${pedido.alerta.especialidade}` : ''}
      descricao="A medida fica registrada no alerta com o seu nome e o horário."
    >
      {pedido && (
        <Formulario
          key={`${pedido.alerta.id}-${pedido.acao}`}
          pedido={pedido}
          onFechar={onFechar}
        />
      )}
    </Modal>
  );
}

function Formulario({ pedido, onFechar }: { pedido: PedidoEscalonamento; onFechar: () => void }) {
  const id = useId();
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const { podeEscrever } = useConexao();
  const [observacao, setObservacao] = useState('');
  const { alerta, acao } = pedido;

  const acionar = useMutation({
    mutationFn: () =>
      cliente.requisitar<Escalonamento>(`/alertas/${alerta.id}/escalonamento`, {
        metodo: 'POST',
        corpo: { acao, ...(observacao.trim() ? { observacao: observacao.trim() } : {}) },
      }),
    onSuccess: (escalonamento) => {
      onFechar();
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `${ROTULO_ACAO[acao]} acionado em ${alerta.especialidade} por ${escalonamento.acionadoPor}, em ${formatarHorario(escalonamento.acionadoEm)}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['alertas', 'abertos'] });
    },
    onError: (erro) =>
      mostrarToast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi && erro.status === 403
            ? 'Seu perfil não tem permissão para acionar medidas de escalonamento.'
            : 'Não foi possível acionar a medida. Verifique a conexão e tente novamente.',
      }),
  });

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        acionar.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium text-texto">
          Observação (opcional)
        </label>
        <textarea
          id={id}
          rows={3}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className={classeCampo}
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variante="secundario" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!podeEscrever || acionar.isPending}>
          {acionar.isPending ? 'Acionando…' : 'Confirmar'}
        </Button>
      </div>
    </form>
  );
}
