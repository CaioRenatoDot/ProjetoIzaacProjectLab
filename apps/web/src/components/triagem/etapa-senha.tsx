'use client';

import { TipoAtendimento, type TipoAtendimento as TipoAtendimentoValor } from '@filas/contracts';
import { Button, classeCampo, Permitido, useConexao } from '@filas/ui';
import { useId, useState } from 'react';

import { Campo } from './campos';
import { useFocoNoTitulo } from './use-foco-titulo';
import { ModalReclassificacao } from '../senha/modal-reclassificacao';
import {
  ROTULO_ENQUADRAMENTO,
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_ATENDIMENTO,
} from '@/lib/triagem/schema';
import {
  ErroTriagem,
  type SenhaEmitida,
  type TriagemApi,
  type TriagemRegistrada,
} from '@/lib/triagem/tipos';

export interface EtapaSenhaProps {
  api: TriagemApi;
  triagem: TriagemRegistrada;
  onNovaTriagem: () => void;
}

/**
 * Etapa 3 de W-06 / W-07: resumo da triagem sem o motivo clínico (P-03), emissão e senha em destaque.
 */
export function EtapaSenha({ api, triagem, onNovaTriagem }: EtapaSenhaProps) {
  const titulo = useFocoNoTitulo();
  const idTipo = useId();
  const { podeEscrever } = useConexao();
  const [tipo, setTipo] = useState<TipoAtendimentoValor>(triagem.tipoAtendimento);
  const [emitindo, setEmitindo] = useState(false);
  const [bloqueio, setBloqueio] = useState<string>();
  const [erroGenerico, setErroGenerico] = useState(false);
  const [senha, setSenha] = useState<SenhaEmitida | null>(null);
  const [reclassificando, setReclassificando] = useState(false);

  async function emitir() {
    setEmitindo(true);
    setBloqueio(undefined);
    setErroGenerico(false);
    try {
      setSenha(await api.emitirSenha({ triagemId: triagem.id, tipoAtendimento: tipo }));
    } catch (e) {
      if (e instanceof ErroTriagem && e.codigo === 'SEM_FILA_CONFIGURADA') setBloqueio(e.message);
      else setErroGenerico(true);
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <section aria-labelledby="titulo-senha" className="flex max-w-2xl flex-col gap-4">
      <h1 id="titulo-senha" ref={titulo} tabIndex={-1} className="text-pagina font-semibold">
        {senha ? 'Senha emitida' : 'Triagem: emitir senha'}
      </h1>
      <p className="text-texto-secundario">Etapa 3 de 3</p>

      {!senha && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-borda-suave p-4">
            <dt className="text-texto-secundario">Paciente</dt>
            <dd>{triagem.pacienteIniciais}</dd>
            <dt className="text-texto-secundario">Especialidade</dt>
            <dd>{triagem.especialidade}</dd>
            <dt className="text-texto-secundario">Prioridade</dt>
            <dd>{ROTULO_PRIORIDADE[triagem.prioridade]}</dd>
            {triagem.enquadramentoLegal && (
              <>
                <dt className="text-texto-secundario">Enquadramento legal</dt>
                <dd>{ROTULO_ENQUADRAMENTO[triagem.enquadramentoLegal]}</dd>
              </>
            )}
          </dl>

          <Campo id={idTipo} rotulo="Tipo de atendimento">
            <select
              id={idTipo}
              value={tipo}
              onChange={(e) => setTipo(TipoAtendimento.parse(e.target.value))}
              className={classeCampo}
            >
              {TipoAtendimento.options.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_ATENDIMENTO[t]}
                </option>
              ))}
            </select>
          </Campo>

          {bloqueio && (
            <div role="alert" className="rounded-md border-2 border-erro p-3 text-texto">
              <p className="font-semibold text-erro">A senha não pôde ser emitida.</p>
              <p>{bloqueio}</p>
            </div>
          )}
          {erroGenerico && (
            <p role="alert" className="text-erro">
              Não foi possível emitir a senha agora. Verifique a conexão e tente de novo.
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => void emitir()}
              disabled={emitindo || !podeEscrever || bloqueio !== undefined}
            >
              Confirmar emissão
            </Button>
          </div>
        </>
      )}

      {senha && (
        <>
          {/* Anunciada pelo leitor de tela assim que a emissão termina. */}
          <div
            aria-live="polite"
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-primaria p-8 text-center"
          >
            <p className="text-secundario text-texto-secundario">Senha</p>
            <p className="text-7xl font-bold" aria-label={`Senha ${senha.numero}`}>
              {senha.numero}
            </p>
            <p className="text-secao font-semibold">
              {ROTULO_PRIORIDADE[senha.prioridade]} · {senha.especialidade}
            </p>
            <p>Posição estimada na fila: {senha.posicaoEstimada}</p>
          </div>

          {senha.avisos.map((a) => (
            <p
              key={a.codigo}
              role="status"
              className="rounded-md bg-alerta-fundo p-3 text-alerta-texto"
            >
              {a.mensagem}
            </p>
          ))}

          <div className="flex flex-wrap justify-end gap-3">
            <Permitido permissao="senha:reclassificar">
              <Button variante="secundario" onClick={() => setReclassificando(true)}>
                Reclassificar prioridade
              </Button>
            </Permitido>
            <Button variante="secundario" onClick={() => window.print()}>
              Imprimir senha
            </Button>
            <Button onClick={onNovaTriagem}>Nova triagem</Button>
          </div>

          <ModalReclassificacao
            api={api}
            aberto={reclassificando}
            onAbertoChange={setReclassificando}
            senha={{
              id: senha.id,
              numero: senha.numero,
              prioridade: senha.prioridade,
              versao: senha.versao,
            }}
            onReclassificada={(r) =>
              setSenha({
                ...senha,
                prioridade: r.prioridade,
                versao: r.versao,
                posicaoEstimada: r.novaPosicao,
              })
            }
            onRecarregada={(atual) => setSenha({ ...senha, ...atual })}
          />
        </>
      )}
    </section>
  );
}
