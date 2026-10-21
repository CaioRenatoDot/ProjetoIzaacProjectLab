'use client';

import { Button, classeCampo, EstadoCarregando, EstadoErro, useConexao, useToast } from '@filas/ui';
import {
  EnquadramentoLegal,
  Prioridade,
  TipoAtendimento,
  type EnquadramentoLegal as EnquadramentoLegalValor,
  type Prioridade as PrioridadeValor,
  type TipoAtendimento as TipoAtendimentoValor,
} from '@filas/contracts';
import { useCallback, useEffect, useId, useState } from 'react';

import { Campo, atributosCampo } from './campos';
import { useAvisoConsultaRegistrada } from './use-aviso-consulta';
import { useFocoNoTitulo } from './use-foco-titulo';
import {
  type ErrosFicha,
  errosPorCampo,
  FichaTriagemSchema,
  prioridadeEfetiva,
  ROTULO_ENQUADRAMENTO,
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_ATENDIMENTO,
} from '@/lib/triagem/schema';
import {
  ErroTriagem,
  type EspecialidadeTriagem,
  type PacienteBusca,
  type TriagemApi,
  type TriagemRegistrada,
} from '@/lib/triagem/tipos';

export interface EtapaFichaProps {
  api: TriagemApi;
  paciente: PacienteBusca;
  onTrocarPaciente: () => void;
  onConcluir: (triagem: TriagemRegistrada) => void;
}

const DICA_ESPECIALIDADE = 'Só aparecem especialidades ativas com fila configurada.';
const DICA_JUSTIFICATIVA = 'Descreva o critério clínico que motivou a urgência.';

/** Ordem em que os campos aparecem: o foco vai para o primeiro inválido. */
const ORDEM_CAMPOS = [
  'especialidadeDestinoId',
  'tipoAtendimento',
  'prioridade',
  'motivo',
  'enquadramentoLegal',
  'justificativaClinica',
  'observacoes',
] as const;

/** Etapa 2 de W-06: ficha de triagem (UC-05). Motivo e justificativa nunca vão para log, URL ou cache. */
export function EtapaFicha({ api, paciente, onTrocarPaciente, onConcluir }: EtapaFichaProps) {
  const titulo = useFocoNoTitulo();
  const prefixo = useId();
  const id = (campo: string) => `${prefixo}-${campo}`;
  const { podeEscrever } = useConexao();
  const mostrarToast = useToast();
  const avisoConsulta = useAvisoConsultaRegistrada();

  const [especialidades, setEspecialidades] = useState<EspecialidadeTriagem[] | 'erro' | null>(
    null,
  );
  const [especialidadeId, setEspecialidadeId] = useState('');
  const [tipo, setTipo] = useState<TipoAtendimentoValor>('PRIMEIRA_CONSULTA');
  const [prioridadeEscolhida, setPrioridadeEscolhida] = useState<PrioridadeValor>('NORMAL');
  const [motivo, setMotivo] = useState('');
  const [enquadramento, setEnquadramento] = useState<EnquadramentoLegalValor | ''>('');
  const [justificativa, setJustificativa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<ErrosFicha>({});
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setEspecialidades(null);
    try {
      setEspecialidades(await api.listarEspecialidades());
    } catch {
      setEspecialidades('erro');
    }
  }, [api]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const prioridade = prioridadeEfetiva(prioridadeEscolhida, enquadramento || undefined);
  const urgente = prioridade === 'URGENTE';

  function focarPrimeiroInvalido(novosErros: ErrosFicha) {
    const primeiro = ORDEM_CAMPOS.find((campo) => novosErros[campo]);
    if (primeiro) document.getElementById(id(primeiro))?.focus();
  }

  async function concluir() {
    const resultado = FichaTriagemSchema.safeParse({
      especialidadeDestinoId: especialidadeId,
      tipoAtendimento: tipo,
      prioridade,
      motivo,
      enquadramentoLegal: enquadramento || undefined,
      justificativaClinica: urgente ? justificativa : undefined,
      observacoes: observacoes || undefined,
    });
    if (!resultado.success) {
      const novosErros = errosPorCampo(resultado.error);
      setErros(novosErros);
      // O foco só pode ir para o campo depois de ele receber `aria-invalid` e o erro.
      requestAnimationFrame(() => focarPrimeiroInvalido(novosErros));
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      const triagem = await api.registrarTriagem({
        pacienteId: paciente.id,
        ...resultado.data,
        especialidadeDestinoId: resultado.data.especialidadeDestinoId,
      });
      onConcluir(triagem);
    } catch (e) {
      mostrarToast({
        tipo: 'erro',
        mensagem:
          e instanceof ErroTriagem
            ? e.message
            : 'Não foi possível registrar a triagem. Verifique a conexão e tente de novo.',
      });
    } finally {
      setEnviando(false);
    }
  }

  const disponiveis = Array.isArray(especialidades)
    ? especialidades.filter((e) => e.ativa && e.filasVinculadas > 0)
    : [];

  return (
    <section aria-labelledby="titulo-ficha" className="flex max-w-2xl flex-col gap-4">
      <h1 id="titulo-ficha" ref={titulo} tabIndex={-1} className="text-pagina font-semibold">
        Triagem: ficha de {paciente.iniciais}
      </h1>
      <p className="text-texto-secundario">Etapa 2 de 3</p>

      {avisoConsulta && (
        <p role="status" className="rounded-md bg-superficie-elevada p-3 text-texto">
          Consultas a dados clínicos ficam registradas na trilha de auditoria.
        </p>
      )}

      {paciente.restricaoAtiva && (
        <div role="alert" className="rounded-md bg-alerta-fundo p-3 text-alerta-texto">
          <p className="font-semibold">Paciente com restrição por ausências repetidas.</p>
          <p>
            {paciente.restricaoAte
              ? `A restrição vale até ${new Date(`${paciente.restricaoAte}T00:00:00`).toLocaleDateString('pt-BR')}. `
              : ''}
            A triagem continua permitida.
          </p>
        </div>
      )}

      {especialidades === null && <EstadoCarregando linhas={5} rotulo="Carregando a ficha" />}
      {especialidades === 'erro' && (
        <EstadoErro
          mensagem="Não foi possível carregar as especialidades. Tente novamente."
          onTentarNovamente={() => void carregar()}
        />
      )}

      {Array.isArray(especialidades) && (
        <>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void concluir();
            }}
          >
            <Campo
              id={id('especialidadeDestinoId')}
              rotulo="Especialidade de destino"
              obrigatorio
              erro={erros.especialidadeDestinoId}
              dica={DICA_ESPECIALIDADE}
            >
              <select
                {...atributosCampo(id('especialidadeDestinoId'), {
                  erro: erros.especialidadeDestinoId,
                  dica: DICA_ESPECIALIDADE,
                })}
                value={especialidadeId}
                onChange={(e) => setEspecialidadeId(e.target.value)}
                className={classeCampo}
              >
                <option value="">Selecione</option>
                {disponiveis.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id={id('tipoAtendimento')} rotulo="Tipo de atendimento" obrigatorio>
              <select
                id={id('tipoAtendimento')}
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

            <Campo id={id('enquadramentoLegal')} rotulo="Enquadramento legal">
              <select
                id={id('enquadramentoLegal')}
                value={enquadramento}
                onChange={(e) =>
                  setEnquadramento(e.target.value ? EnquadramentoLegal.parse(e.target.value) : '')
                }
                className={classeCampo}
              >
                <option value="">Nenhum</option>
                {EnquadramentoLegal.options.map((o) => (
                  <option key={o} value={o}>
                    {ROTULO_ENQUADRAMENTO[o]}
                  </option>
                ))}
              </select>
            </Campo>

            {/* RN-02: a região existe antes do aviso, para o leitor de tela anunciá-lo ao aparecer. */}
            <div role="status">
              {enquadramento && (
                <p className="rounded-md bg-superficie-elevada p-3 text-texto">
                  Enquadramento legal informado: a prioridade foi marcada como Preferencial.
                </p>
              )}
            </div>

            <Campo id={id('prioridade')} rotulo="Prioridade" obrigatorio erro={erros.prioridade}>
              <select
                {...atributosCampo(id('prioridade'), { erro: erros.prioridade })}
                value={prioridade}
                onChange={(e) => setPrioridadeEscolhida(Prioridade.parse(e.target.value))}
                className={classeCampo}
              >
                {Prioridade.options.map((p) => (
                  <option key={p} value={p} disabled={enquadramento !== '' && p === 'NORMAL'}>
                    {ROTULO_PRIORIDADE[p]}
                  </option>
                ))}
              </select>
            </Campo>

            {/* RN-03: campo condicional dentro de região viva, anunciado ao aparecer. */}
            <div aria-live="polite">
              {urgente && (
                <Campo
                  id={id('justificativaClinica')}
                  rotulo="Justificativa clínica"
                  obrigatorio
                  erro={erros.justificativaClinica}
                  dica={DICA_JUSTIFICATIVA}
                >
                  <textarea
                    {...atributosCampo(id('justificativaClinica'), {
                      erro: erros.justificativaClinica,
                      dica: DICA_JUSTIFICATIVA,
                    })}
                    rows={3}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    className={classeCampo}
                  />
                </Campo>
              )}
            </div>

            <Campo id={id('motivo')} rotulo="Motivo do atendimento" obrigatorio erro={erros.motivo}>
              <textarea
                {...atributosCampo(id('motivo'), { erro: erros.motivo })}
                rows={4}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={classeCampo}
              />
            </Campo>

            <Campo id={id('observacoes')} rotulo="Observações">
              <textarea
                id={id('observacoes')}
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className={classeCampo}
              />
            </Campo>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variante="secundario" onClick={onTrocarPaciente} disabled={enviando}>
                Trocar paciente
              </Button>
              <Button type="submit" disabled={enviando || !podeEscrever}>
                Concluir triagem
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
