'use client';

import {
  Button,
  classesBotao,
  EtiquetaStatus,
  PainelLateral,
  Permitido,
  useConexao,
  useToast,
} from '@filas/ui';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ModalReclassificacao } from '@/components/senha/modal-reclassificacao';
import { AcoesAusenciaDesistencia } from '@/components/senha/acoes-ausencia-desistencia';
import { ErroApi } from '@/lib/api/cliente-http';
import { criarAusenciasApi } from '@/lib/ausencias/api';
import { type FilaApi } from '@/lib/fila/api';
import {
  horaCurta,
  minutosDesde,
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_ATENDIMENTO,
  textoMinutos,
} from '@/lib/fila/quadro';
import { criarReclassificacaoHttp } from '@/lib/fila/reclassificacao-http';
import { type SenhaResumo } from '@/lib/fila/tipos';
import { useSessao } from '@/lib/sessao/sessao';
import { podeReclassificar } from '@/lib/triagem/reclassificacao';

export interface PainelSenhaProps {
  api: FilaApi;
  senha: SenhaResumo;
  agora: number;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  /** Recarrega o quadro depois de uma ação (ou de um 409 que pede recarga). */
  onAtualizar: () => void;
  onAnunciar: (texto: string) => void;
}

const EM_ATENDIMENTO = ['EM_ATENDIMENTO', 'PAUSADO', 'PENDENTE_VALIDACAO'];

/**
 * Painel lateral de "Detalhes" (ADR-002): dados da senha e as ações permitidas pelo status e pelo
 * perfil (T-09). Ação sem permissão não aparece. Alocação e atendimento são telas próprias.
 * Abaixo de 768 px, só consulta e rechamada (T-09, responsivo).
 */
export function PainelSenha({
  api,
  senha,
  agora,
  aberto,
  onAbertoChange,
  onAtualizar,
  onAnunciar,
}: PainelSenhaProps) {
  const { cliente } = useSessao();
  const { podeEscrever } = useConexao();
  const mostrarToast = useToast();
  const ausencias = useMemo(() => criarAusenciasApi(cliente), [cliente]);
  const reclassificacao = useMemo(() => criarReclassificacaoHttp(cliente), [cliente]);
  const [reclassificando, setReclassificando] = useState(false);

  const rechamar = useMutation({
    mutationFn: () => api.rechamar(senha.chamadaId ?? ''),
    onSuccess: (chamada) => {
      mostrarToast({ tipo: 'sucesso', mensagem: `Senha ${senha.numero} rechamada no telão.` });
      onAnunciar(`Senha ${senha.numero} rechamada (chamada ${chamada.sequencia}).`);
      onAtualizar();
    },
    onError: (erro) => {
      mostrarToast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi
            ? erro.detail
            : 'Não foi possível rechamar. Verifique a conexão e tente novamente.',
      });
      onAtualizar();
    },
  });

  const chamada = senha.status === 'CHAMADA';
  const comAlocacao = chamada || senha.status === 'AGUARDANDO_RECURSO';

  return (
    <PainelLateral
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={`Detalhes da senha ${senha.numero}`}
      descricao="Dados da senha, sem conteúdo clínico, e as ações disponíveis para o seu perfil."
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">Paciente</dt>
        <dd>{senha.pacienteIniciais}</dd>
        <dt className="font-medium">Especialidade</dt>
        <dd>{senha.especialidade}</dd>
        <dt className="font-medium">Prioridade</dt>
        <dd>{ROTULO_PRIORIDADE[senha.prioridade]}</dd>
        <dt className="font-medium">Tipo</dt>
        <dd>{ROTULO_TIPO_ATENDIMENTO[senha.tipoAtendimento]}</dd>
        <dt className="font-medium">Status</dt>
        <dd>
          <EtiquetaStatus status={senha.status} />
        </dd>
        <dt className="font-medium">Chegada</dt>
        <dd>
          {horaCurta(senha.chegadaEm)} (espera de{' '}
          {textoMinutos(minutosDesde(senha.chegadaEm, agora))})
        </dd>
        {senha.posicao !== null && (
          <>
            <dt className="font-medium">Posição</dt>
            <dd>{senha.posicao}ª na fila</dd>
          </>
        )}
        {chamada && senha.toleranciaAte && (
          <>
            <dt className="font-medium">Tolerância até</dt>
            <dd>{horaCurta(senha.toleranciaAte)}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-3">
        {chamada && senha.chamadaId && (
          <Permitido permissao="fila:chamar">
            <Button
              variante="secundario"
              disabled={!podeEscrever || rechamar.isPending}
              onClick={() => rechamar.mutate()}
            >
              Rechamar
            </Button>
          </Permitido>
        )}

        <div className="hidden flex-col gap-3 md:flex">
          {comAlocacao && (
            <Permitido permissao="alocacao:criar">
              <Link
                href={`/fila/senhas/${encodeURIComponent(senha.id)}/alocacao`}
                className={classesBotao.primario}
              >
                Alocar recursos
              </Link>
            </Permitido>
          )}

          {comAlocacao && (
            <Permitido permissao="atendimento:criar">
              <Link
                href={`/atendimento?senha=${encodeURIComponent(senha.id)}`}
                className={classesBotao.secundario}
              >
                Iniciar atendimento
              </Link>
            </Permitido>
          )}

          {podeReclassificar(senha.status) && (
            <Permitido permissao="senha:reclassificar">
              <Button
                variante="secundario"
                disabled={!podeEscrever}
                onClick={() => setReclassificando(true)}
              >
                Reclassificar prioridade
              </Button>
            </Permitido>
          )}

          {EM_ATENDIMENTO.includes(senha.status) && (
            <p className="text-texto-secundario">
              Pausar, retomar, encerrar e validar ficam na tela de Atendimento.{' '}
              <Permitido permissao="atendimento:consultar">
                <Link
                  href={`/atendimento?senha=${encodeURIComponent(senha.id)}`}
                  className="font-medium text-informacao underline"
                >
                  Abrir atendimento
                </Link>
              </Permitido>
            </p>
          )}

          <AcoesAusenciaDesistencia
            api={ausencias}
            senha={senha}
            onRegistrada={() => {
              onAtualizar();
              onAbertoChange(false);
            }}
            onAtualizar={onAtualizar}
          />
        </div>
      </div>

      {reclassificando && (
        <ModalReclassificacao
          api={reclassificacao}
          aberto
          onAbertoChange={setReclassificando}
          senha={senha}
          onReclassificada={({ prioridade, novaPosicao }) => {
            onAnunciar(
              `Senha ${senha.numero} reclassificada para ${ROTULO_PRIORIDADE[prioridade]}. Nova posição: ${novaPosicao}ª.`,
            );
            onAtualizar();
          }}
          onRecarregada={onAtualizar}
        />
      )}
    </PainelLateral>
  );
}
