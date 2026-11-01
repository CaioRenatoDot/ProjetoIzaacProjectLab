'use client';

import {
  Button,
  classeCampo,
  EstadoSemPermissao,
  Modal,
  useConexao,
  usePermissoes,
} from '@filas/ui';
import { useEffect, useId, useRef, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import {
  type AusenciasApi,
  type RegistroAusencia,
  type RegistroDesistencia,
  type SenhaOcorrencia,
} from '@/lib/ausencias/api';

interface ModalOcorrenciaProps {
  api: AusenciasApi;
  senha: SenhaOcorrencia;
  variante: 'ausencia' | 'desistencia';
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  onRegistrada: (registro: RegistroAusencia | RegistroDesistencia) => void;
  onAtualizar: () => void;
}

export function ModalOcorrencia({
  api,
  senha,
  variante,
  aberto,
  onAbertoChange,
  onRegistrada,
  onAtualizar,
}: ModalOcorrenciaProps) {
  const id = useId();
  const { tem } = usePermissoes();
  const { podeEscrever } = useConexao();
  const [agora, setAgora] = useState(Date.now);
  const [texto, setTexto] = useState('');
  const [origem, setOrigem] = useState<'PACIENTE' | 'EQUIPE'>('PACIENTE');
  const [confirmada, setConfirmada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const emVoo = useRef(false);
  const [erro, setErro] = useState('');
  const [negado, setNegado] = useState(false);
  const [conflito, setConflito] = useState(false);
  const ausencia = variante === 'ausencia';
  const autorizada = tem('ausencia:criar') && !negado;
  const elegivel = ausencia
    ? senha.status === 'CHAMADA'
    : senha.status === 'AGUARDANDO' || senha.status === 'EM_ATENDIMENTO';
  const prazo = senha.toleranciaAte ? Date.parse(senha.toleranciaAte) : NaN;
  const prazoValido = Number.isFinite(prazo);
  const segundos = Math.max(0, Math.ceil((prazo - agora) / 1000));
  const antecipada = ausencia && prazoValido && segundos > 0;
  const restante = `${Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0')}:${(segundos % 60).toString().padStart(2, '0')}`;
  const bloqueada =
    !autorizada ||
    !elegivel ||
    !podeEscrever ||
    conflito ||
    (ausencia && !prazoValido) ||
    (antecipada && !confirmada);

  useEffect(() => {
    if (!aberto || !ausencia) return;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [aberto, ausencia]);

  async function confirmar() {
    if (bloqueada || emVoo.current) return;
    emVoo.current = true;
    setEnviando(true);
    setErro('');
    let resultado: RegistroAusencia | RegistroDesistencia;
    try {
      resultado = ausencia
        ? await api.registrarAusencia(senha.id, {
            versao: senha.versao,
            ...(texto.trim() ? { observacao: texto.trim() } : {}),
            confirmadoAntesDaTolerancia: antecipada && confirmada,
          })
        : await api.registrarDesistencia(senha.id, {
            versao: senha.versao,
            origem,
            ...(texto.trim() ? { motivo: texto.trim() } : {}),
          });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 403) setNegado(true);
      else if (e instanceof ErroApi && e.status === 409) {
        setConflito(true);
        setErro(
          'A senha mudou ou esta ação não está mais disponível. Atualize a senha antes de continuar.',
        );
      } else
        setErro(
          e instanceof ErroApi
            ? e.detail
            : 'Não foi possível registrar. Verifique a conexão e tente novamente.',
        );
      return;
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
    onRegistrada(resultado);
    onAbertoChange(false);
  }

  return (
    <Modal
      aberto={aberto}
      onAbertoChange={(valor) => {
        if (!emVoo.current) onAbertoChange(valor);
      }}
      titulo={`Registrar ${ausencia ? 'ausência' : 'desistência'} — senha ${senha.numero}`}
      descricao={
        ausencia
          ? 'Confirme o não comparecimento. Os recursos alocados serão liberados.'
          : 'A senha sairá da fila ativa e os recursos alocados serão liberados. Desistência é contabilizada separadamente de ausência.'
      }
      telaCheiaNoCelular
    >
      {!autorizada ? (
        <EstadoSemPermissao />
      ) : !elegivel ? (
        <p role="alert">Esta ação não está disponível para o status atual. Atualize a senha.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirmar();
          }}
          className="flex flex-col gap-4"
          aria-busy={enviando}
        >
          {ausencia && !prazoValido && (
            <p role="alert">
              Não foi possível consultar a tolerância. Atualize a senha antes de registrar a
              ausência.
            </p>
          )}
          {antecipada && (
            <div className="rounded bg-alerta-fundo p-3 text-alerta-texto">
              <p>A tolerância ainda não expirou. Restam {restante}.</p>
              <label className="flex min-h-toque items-center gap-2" htmlFor={`${id}-confirmacao`}>
                <input
                  id={`${id}-confirmacao`}
                  type="checkbox"
                  checked={confirmada}
                  onChange={(e) => setConfirmada(e.target.checked)}
                  disabled={enviando}
                />
                Confirmo o registro de ausência antes do fim da tolerância.
              </label>
            </div>
          )}
          {ausencia && prazoValido && !antecipada && <p>A tolerância expirou.</p>}
          {!ausencia && (
            <fieldset disabled={enviando} className="flex flex-col gap-2">
              <legend className="font-medium">Solicitado por</legend>
              {(['PACIENTE', 'EQUIPE'] as const).map((valor) => (
                <label key={valor} className="flex min-h-toque items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-origem`}
                    value={valor}
                    checked={origem === valor}
                    onChange={() => setOrigem(valor)}
                  />
                  {valor === 'PACIENTE' ? 'Paciente' : 'Equipe'}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-texto`} className="font-medium">
              {ausencia ? 'Observação (opcional)' : 'Motivo da desistência (opcional)'}
            </label>
            <textarea
              id={`${id}-texto`}
              rows={3}
              value={texto}
              disabled={enviando}
              onChange={(e) => setTexto(e.target.value)}
              className={classeCampo}
            />
          </div>
          {!podeEscrever && (
            <p role="alert">Conexão perdida. Aguarde a reconexão para confirmar.</p>
          )}
          {erro && <p role="alert">{erro}</p>}
          {enviando && <p role="status">Registrando…</p>}
          {(conflito || (ausencia && !prazoValido)) && (
            <Button
              variante="secundario"
              onClick={() => {
                onAbertoChange(false);
                onAtualizar();
              }}
            >
              Atualizar senha
            </Button>
          )}
          <div className="flex justify-end gap-3">
            <Button variante="secundario" disabled={enviando} onClick={() => onAbertoChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variante="destrutivo" disabled={bloqueada || enviando}>
              Confirmar
            </Button>
          </div>
        </form>
      )}
      {(!autorizada || !elegivel) && (
        <Button variante="secundario" onClick={() => onAbertoChange(false)}>
          Fechar
        </Button>
      )}
    </Modal>
  );
}
