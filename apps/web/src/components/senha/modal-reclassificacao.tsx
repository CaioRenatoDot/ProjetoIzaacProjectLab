'use client';

import { Prioridade, type Prioridade as PrioridadeValor } from '@filas/contracts';
import { Button, classeCampo, ErroCampo, Modal, useToast } from '@filas/ui';
import { useEffect, useId, useRef, useState } from 'react';

import { prioridadesDisponiveis } from '@/lib/triagem/reclassificacao';
import { ROTULO_PRIORIDADE } from '@/lib/triagem/schema';
import { ErroTriagem, type Reclassificacao, type TriagemApi } from '@/lib/triagem/tipos';

export interface SenhaReclassificavel {
  id: string;
  numero: string;
  prioridade: PrioridadeValor;
  versao: number;
}

export interface ModalReclassificacaoProps {
  api: Pick<
    TriagemApi,
    'historicoReclassificacoes' | 'consultarSenha' | 'reclassificar' | 'parametros'
  >;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  senha: SenhaReclassificavel;
  /** Chamado após confirmar, com a prioridade, a posição e a versão novas. */
  onReclassificada: (resultado: {
    prioridade: PrioridadeValor;
    novaPosicao: number;
    versao: number;
  }) => void;
  /** Chamado quando o servidor recusa por `VERSAO_DESATUALIZADA`, com a senha já recarregada. */
  onRecarregada?: (senha: { prioridade: PrioridadeValor; versao: number }) => void;
}

/**
 * Modal de reclassificação de prioridade (UC-07, RN-01), reutilizado pelo painel de fila (6.4).
 * O mínimo da justificativa vem do parâmetro da unidade, nunca fixo no código.
 */
export function ModalReclassificacao({
  api,
  aberto,
  onAbertoChange,
  senha,
  onReclassificada,
  onRecarregada,
}: ModalReclassificacaoProps) {
  const id = useId();
  const campoJustificativa = useRef<HTMLTextAreaElement>(null);
  const mostrarToast = useToast();
  const opcoes = prioridadesDisponiveis(Prioridade.options, senha.prioridade);

  const [nova, setNova] = useState<PrioridadeValor>(opcoes[0] ?? 'NORMAL');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState<string>();
  const [historico, setHistorico] = useState<Reclassificacao[] | null>(null);
  const [minimo, setMinimo] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNova(prioridadesDisponiveis(Prioridade.options, senha.prioridade)[0] ?? 'NORMAL');
    setJustificativa('');
    setErro(undefined);
    setHistorico(null);
    void api.historicoReclassificacoes(senha.id).then(setHistorico);
    void api.parametros().then((p) => setMinimo(p.justificativaMinCaracteres));
  }, [aberto, api, senha.id, senha.prioridade]);

  const vazia = justificativa.trim().length === 0;

  async function confirmar() {
    const texto = justificativa.trim();
    if (minimo !== null && texto.length < minimo) {
      setErro(`A justificativa precisa ter ao menos ${minimo} caracteres.`);
      campoJustificativa.current?.focus();
      return;
    }
    setErro(undefined);
    setEnviando(true);
    try {
      const resultado = await api.reclassificar({
        senhaId: senha.id,
        prioridade: nova,
        justificativa: texto,
        versao: senha.versao,
      });
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `Prioridade da senha ${senha.numero} alterada para ${ROTULO_PRIORIDADE[nova]}. Nova posição: ${resultado.novaPosicao}.`,
      });
      onReclassificada(resultado);
      onAbertoChange(false);
    } catch (e) {
      if (e instanceof ErroTriagem && e.codigo === 'VERSAO_DESATUALIZADA') {
        const atual = await api.consultarSenha(senha.id);
        onRecarregada?.({ prioridade: atual.prioridade, versao: atual.versao });
        setErro(`${e.message} A prioridade atual é ${ROTULO_PRIORIDADE[atual.prioridade]}.`);
      } else if (e instanceof ErroTriagem) {
        setErro(e.message);
        campoJustificativa.current?.focus();
      } else {
        setErro('Não foi possível reclassificar agora. Verifique a conexão e tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={`Reclassificar prioridade da senha ${senha.numero}`}
      descricao={`Prioridade atual: ${ROTULO_PRIORIDADE[senha.prioridade]}.`}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-nova`} className="font-medium">
          Nova prioridade
        </label>
        <select
          id={`${id}-nova`}
          value={nova}
          onChange={(e) => setNova(Prioridade.parse(e.target.value))}
          className={classeCampo}
        >
          {opcoes.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PRIORIDADE[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-justificativa`} className="font-medium">
          Justificativa
        </label>
        <p id={`${id}-dica`} className="text-secundario text-texto-secundario">
          {minimo === null
            ? 'A justificativa é obrigatória.'
            : `A justificativa é obrigatória (mínimo de ${minimo} caracteres) e fica registrada na auditoria.`}
        </p>
        <textarea
          id={`${id}-justificativa`}
          ref={campoJustificativa}
          rows={4}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={`${id}-dica${erro ? ` ${id}-erro` : ''}`}
          className={classeCampo}
        />
        {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
      </div>

      <section aria-label="Histórico de reclassificações" className="flex flex-col gap-1">
        <h3 className="font-medium">Histórico</h3>
        {historico === null ? (
          <p className="text-texto-secundario">Carregando histórico…</p>
        ) : historico.length === 0 ? (
          <p className="text-texto-secundario">Nenhuma reclassificação anterior.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historico.map((h) => (
              <li key={h.id} className="text-secundario">
                <span className="font-medium">
                  {ROTULO_PRIORIDADE[h.dePrioridade]} → {ROTULO_PRIORIDADE[h.paraPrioridade]}
                </span>{' '}
                por {h.usuarioNome} em {new Date(h.ocorridoEm).toLocaleString('pt-BR')}:{' '}
                {h.justificativa}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button variante="secundario" onClick={() => onAbertoChange(false)}>
          Cancelar
        </Button>
        <Button onClick={() => void confirmar()} disabled={vazia || enviando}>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
