'use client';

import { type Desfecho } from '@filas/contracts';
import { Button, classeCampo, ErroCampo, Modal } from '@filas/ui';
import { useId, useRef, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { ROTULO_DESFECHO } from '@/lib/atendimento/estado';

const DESFECHOS = Object.keys(ROTULO_DESFECHO) as Desfecho[];

/** Mensagem do campo vinda do 422 (`campos[]`), ou o `detail` quando o campo não vem. */
function erroDoCampo(falha: unknown, campo: string) {
  if (!(falha instanceof ErroApi) || falha.status !== 422) return null;
  return falha.campos.find((c) => c.campo === campo)?.mensagem ?? falha.detail;
}

/** Pausa (UC-12): o motivo é exigido quando o protocolo do serviço manda, e a API responde 422. */
export function ModalPausa({
  numero,
  onFechar,
  onConfirmar,
}: {
  numero: string;
  onFechar: () => void;
  onConfirmar: (motivo: string | undefined) => Promise<unknown>;
}) {
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar(motivo.trim() || undefined);
    } catch (falha) {
      const doCampo = erroDoCampo(falha, 'motivo');
      if (!doCampo) throw falha;
      setErro(doCampo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onAbertoChange={(aberto) => !aberto && onFechar()}
      titulo={`Pausar o atendimento da senha ${numero}`}
      descricao="O tempo pausado não conta na duração do atendimento."
      telaCheiaNoCelular
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-motivo`} className="font-medium">
          Motivo da pausa
        </label>
        <p id={`${id}-ajuda`} className="text-secundario text-texto-secundario">
          Obrigatório quando o protocolo do serviço exigir.
        </p>
        <textarea
          id={`${id}-motivo`}
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={`${id}-ajuda${erro ? ` ${id}-erro` : ''}`}
          className={classeCampo}
        />
        {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
      </div>
      <div className="flex justify-end gap-3">
        <Button variante="secundario" onClick={onFechar}>
          Cancelar
        </Button>
        <Button disabled={enviando} aria-busy={enviando} onClick={() => void confirmar()}>
          Pausar
        </Button>
      </div>
    </Modal>
  );
}

/** W-13, à esquerda: encerramento com desfecho obrigatório e observações (UC-13). */
export function ModalEncerramento({
  numero,
  inicial,
  onFechar,
  onConfirmar,
}: {
  numero: string;
  /** Reenvio depois de uma recusa do supervisor: o formulário vem com o que foi registrado. */
  inicial?: { desfecho: Desfecho | null; observacoes: string | null };
  onFechar: () => void;
  onConfirmar: (entrada: { desfecho: Desfecho; observacoes?: string }) => Promise<unknown>;
}) {
  const id = useId();
  const grupo = useRef<HTMLFieldSetElement>(null);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(inicial?.desfecho ?? null);
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function encerrar() {
    if (!desfecho) {
      setErro('Escolha o desfecho para encerrar o atendimento.');
      grupo.current?.querySelector('input')?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar({ desfecho, observacoes: observacoes.trim() || undefined });
    } catch (falha) {
      const doCampo = erroDoCampo(falha, 'desfecho');
      if (!doCampo) throw falha;
      setErro(doCampo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onAbertoChange={(aberto) => !aberto && onFechar()}
      titulo={`Encerrar atendimento: senha ${numero}`}
      descricao="Quando o serviço exige validação, o encerramento segue para o supervisor."
      telaCheiaNoCelular
    >
      <fieldset
        ref={grupo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className="flex flex-col gap-2"
      >
        <legend className="mb-1 font-medium">Desfecho (obrigatório)</legend>
        {DESFECHOS.map((valor) => (
          <label key={valor} className="flex min-h-toque items-center gap-3">
            <input
              type="radio"
              name={`${id}-desfecho`}
              value={valor}
              checked={desfecho === valor}
              onChange={() => {
                setDesfecho(valor);
                setErro(null);
              }}
              className="size-5"
            />
            {ROTULO_DESFECHO[valor]}
          </label>
        ))}
        {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-observacoes`} className="font-medium">
          Observações do desfecho (opcional)
        </label>
        <textarea
          id={`${id}-observacoes`}
          rows={4}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className={classeCampo}
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variante="secundario" onClick={onFechar}>
          Cancelar
        </Button>
        <Button disabled={enviando} aria-busy={enviando} onClick={() => void encerrar()}>
          {enviando ? 'Encerrando…' : 'Encerrar'}
        </Button>
      </div>
    </Modal>
  );
}
