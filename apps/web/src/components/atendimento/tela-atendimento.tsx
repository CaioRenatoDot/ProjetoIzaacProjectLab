'use client';

import {
  type AtendimentoDetalhe,
  type AtendimentoResumo,
  type Desfecho,
  type StatusSenha,
} from '@filas/contracts';
import {
  APRESENTACAO_STATUS,
  Button,
  classeCampo,
  classesBotao,
  ErroCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EtiquetaStatus,
  Permitido,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { COM_ATENDIMENTO, criarAtendimentoApi } from '@/lib/atendimento/api';
import {
  acoesDoEstado,
  duracaoAgora,
  duracaoTexto,
  ROTULO_DESFECHO,
} from '@/lib/atendimento/estado';
import { horaCurta } from '@/lib/fila/quadro';
import { type SenhaResumo } from '@/lib/fila/tipos';
import { useSessao } from '@/lib/sessao/sessao';

import { ModalEncerramento, ModalPausa } from './modais-atendimento';

type Api = ReturnType<typeof criarAtendimentoApi>;

const rotuloStatus = (status: StatusSenha) => APRESENTACAO_STATUS[status].rotulo;

const ROTULO_PRIORIDADE = { NORMAL: 'Normal', PREFERENCIAL: 'Preferencial', URGENTE: 'Urgente' };

/** W-12 / W-13 / T-13: condução do atendimento, do início ao encerramento (UC-11 a UC-13). */
export function TelaAtendimento({ senhaId }: { senhaId: string }) {
  const { tem } = usePermissoes();
  if (!tem('atendimento:consultar')) return <EstadoSemPermissao />;
  return <Atendimento senhaId={senhaId} />;
}

function Atendimento({ senhaId }: { senhaId: string }) {
  const { cliente } = useSessao();
  const { tem } = usePermissoes();
  const api = useMemo(() => criarAtendimentoApi(cliente), [cliente]);

  const senha = useQuery({
    queryKey: ['atendimento', senhaId, 'senha'],
    queryFn: () => api.senha(senhaId),
  });
  const comAtendimento = Boolean(senha.data && COM_ATENDIMENTO.includes(senha.data.status));
  const resumo = useQuery({
    queryKey: ['atendimento', senhaId, 'resumo', senha.data?.status],
    queryFn: () => api.daSenha(senha.data!),
    enabled: comAtendimento,
    placeholderData: keepPreviousData,
  });
  const atendimentoId = resumo.data?.id;
  const detalhe = useQuery({
    queryKey: ['atendimento', senhaId, 'detalhe', atendimentoId],
    queryFn: () => api.detalhe(atendimentoId!),
    enabled: Boolean(atendimentoId) && tem('atendimento:consultar_sensivel'),
    placeholderData: keepPreviousData,
  });
  // Ficam aqui, e não na condução, para sobreviver à recarga que segue cada ação.
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const regiaoAnuncio = (
    <p role="status" aria-live="polite" className="sr-only">
      {anuncio}
    </p>
  );

  const erro = senha.error ?? resumo.error ?? detalhe.error;
  let conteudo: ReactNode;
  if (erro) {
    conteudo =
      erro instanceof ErroApi && erro.status === 403 ? (
        <EstadoSemPermissao />
      ) : (
        <EstadoErro
          mensagem="Não foi possível carregar o atendimento. Verifique a conexão e tente novamente."
          onTentarNovamente={() => {
            void senha.refetch();
            if (comAtendimento) void resumo.refetch();
            if (atendimentoId) void detalhe.refetch();
          }}
        />
      );
  } else if (
    senha.isPending ||
    (comAtendimento && resumo.isPending) ||
    (atendimentoId && detalhe.isPending && detalhe.fetchStatus !== 'idle')
  ) {
    conteudo = <EstadoCarregando linhas={6} rotulo="Carregando o atendimento" />;
  } else if (!senha.data) {
    conteudo = null;
  } else if (comAtendimento && !resumo.data) {
    conteudo = (
      <SemAtendimento>
        Não encontramos o atendimento da senha {senha.data.numero}. Volte à fila e abra de novo.
      </SemAtendimento>
    );
  } else {
    conteudo = (
      <Conducao
        api={api}
        senha={senha.data}
        atendimento={detalhe.data ?? resumo.data ?? null}
        lidoEm={detalhe.dataUpdatedAt || resumo.dataUpdatedAt}
        aviso={aviso}
        setAviso={setAviso}
        setAnuncio={setAnuncio}
      />
    );
  }

  return (
    <>
      {regiaoAnuncio}
      {conteudo}
    </>
  );
}

interface Aviso {
  texto: string;
  alocar?: boolean;
}

function SemAtendimento({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-6">
      <p>{children}</p>
      <Link href="/fila" className={classesBotao.secundario}>
        Voltar à fila
      </Link>
    </div>
  );
}

const ehDetalhe = (a: AtendimentoResumo | AtendimentoDetalhe): a is AtendimentoDetalhe =>
  'triagem' in a;

type Modal = 'pausa' | 'encerramento' | null;

function Conducao({
  api,
  senha,
  atendimento,
  lidoEm,
  aviso,
  setAviso,
  setAnuncio,
}: {
  api: Api;
  senha: SenhaResumo;
  atendimento: AtendimentoResumo | AtendimentoDetalhe | null;
  lidoEm: number;
  aviso: Aviso | null;
  setAviso: (aviso: Aviso | null) => void;
  setAnuncio: (texto: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const { tem } = usePermissoes();
  const { podeEscrever } = useConexao();
  const alerta = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const status = senha.status;
  const versao = atendimento?.versao ?? senha.versao;
  const acoes = acoesDoEstado(status, tem);
  const detalhe = atendimento && ehDetalhe(atendimento) ? atendimento : null;
  const recusado = status === 'PENDENTE_VALIDACAO' && Boolean(detalhe?.parecerSupervisor);

  useEffect(() => {
    if (status !== 'EM_ATENDIMENTO') return;
    const relogio = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(relogio);
  }, [status]);

  useEffect(() => {
    if (aviso) alerta.current?.focus();
  }, [aviso]);

  /** Recarrega senha e atendimento; devolve o status novo, para dizer o que mudou. */
  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: ['atendimento', senha.id] });
    void queryClient.invalidateQueries({ queryKey: ['fila'] });
    return queryClient.getQueryData<SenhaResumo>(['atendimento', senha.id, 'senha'])?.status;
  }

  /**
   * Executa uma ação de escrita. Erro de campo (422) volta para o modal; os demais viram o aviso
   * da tela. Toda ação envia `versao`: 409 VERSAO_DESATUALIZADA recarrega e diz o que mudou.
   */
  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    if (enviando || !podeEscrever) return;
    setEnviando(true);
    setAviso(null);
    try {
      await acao();
      setModal(null);
      const novo = await recarregar();
      setAnuncio(novo ? `${sucesso} Status: ${rotuloStatus(novo)}.` : sucesso);
    } catch (falha) {
      if (falha instanceof ErroApi && falha.status === 422) throw falha;
      setModal(null);
      const codigo = falha instanceof ErroApi ? falha.codigo : '';
      const detail =
        falha instanceof ErroApi
          ? falha.detail
          : 'Não foi possível concluir. Verifique a conexão e tente novamente.';
      if (codigo === 'VERSAO_DESATUALIZADA') {
        const novo = await recarregar();
        setAviso({
          texto:
            novo && novo !== status
              ? `Outra pessoa alterou este atendimento: o status passou de ${rotuloStatus(status)} para ${rotuloStatus(novo)}. Confira os dados antes de continuar.`
              : 'Outra pessoa alterou este atendimento. Os dados foram recarregados: confira antes de continuar.',
        });
      } else if (codigo === 'RECURSO_INDISPONIVEL') {
        // T-13: recurso indisponível no início devolve para a alocação; na retomada, pede nova
        // alocação, que o contrato ainda não oferece para senha pausada (docs/07).
        setAviso(
          status === 'PAUSADO'
            ? { texto: `${detail} A retomada precisa de nova alocação: avise a recepção.` }
            : { texto: `${detail} É preciso refazer a alocação.`, alocar: true },
        );
      } else {
        setAviso({
          texto: detail,
          alocar:
            codigo === 'TRANSICAO_INVALIDA' && ['CHAMADA', 'AGUARDANDO_RECURSO'].includes(status),
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function encerrar(entrada: { desfecho: Desfecho; observacoes?: string }) {
    if (!atendimento) return;
    let encaminhar = false;
    let validacao = false;
    await executar(async () => {
      const resposta = await api.encerrar(atendimento.id, { ...entrada, versao });
      encaminhar = resposta.exigeEncaminhamento;
      validacao = resposta.exigeValidacao;
    }, 'Encerramento registrado.');
    if (validacao) {
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `Senha ${senha.numero} enviada para validação do supervisor (RN-11).`,
      });
    }
    if (encaminhar) {
      router.push(`/encaminhamento?atendimento=${encodeURIComponent(atendimento.id)}`);
    }
  }

  const duracao = atendimento ? duracaoAgora(atendimento, lidoEm, agora) : null;
  const recursos = atendimento
    ? [
        `Estudante: ${atendimento.estudante}`,
        atendimento.supervisor && `Supervisor: ${atendimento.supervisor}`,
        atendimento.iniciadoEm && `Início: ${horaCurta(atendimento.iniciadoEm)}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-pagina font-semibold">
            Atendimento: senha {senha.numero}
            {atendimento && ` · ${atendimento.sala}`}
          </h1>
          <EtiquetaStatus status={status} />
        </div>
        <p className="text-texto-secundario">
          {senha.especialidade} · Paciente {detalhe?.pacienteNome ?? senha.pacienteIniciais}
        </p>
        {recursos && <p>{recursos}</p>}
        {duracao !== null && (
          <p>
            <span className="font-medium">Duração:</span> {duracaoTexto(duracao)}
            {status === 'PAUSADO' && ' (parada durante a pausa)'}
          </p>
        )}
      </header>

      {aviso && (
        <div
          ref={alerta}
          tabIndex={-1}
          role="alert"
          className="flex flex-col items-start gap-2 rounded-md border-2 border-erro p-3"
        >
          <p className="flex items-start gap-1 text-erro">
            <span aria-hidden="true">⚠</span>
            <span>{aviso.texto}</span>
          </p>
          {aviso.alocar && (
            <Permitido permissao="alocacao:criar">
              <Link
                href={`/fila/senhas/${encodeURIComponent(senha.id)}/alocacao`}
                className={classesBotao.secundario}
              >
                Ir para a alocação
              </Link>
            </Permitido>
          )}
        </div>
      )}

      {!atendimento && ['CHAMADA', 'AGUARDANDO_RECURSO'].includes(status) && (
        <p className="rounded-md bg-superficie-elevada p-3">
          Atendimento ainda não iniciado. Os dados da triagem aparecem depois do início.
        </p>
      )}
      {!atendimento && !['CHAMADA', 'AGUARDANDO_RECURSO'].includes(status) && (
        <SemAtendimento>
          A senha {senha.numero} está {rotuloStatus(status).toLocaleLowerCase('pt-BR')}: não há
          atendimento a conduzir.
        </SemAtendimento>
      )}

      {detalhe && <DadosTriagem detalhe={detalhe} />}
      {detalhe && <RegistroAtendimento detalhe={detalhe} />}

      {acoes.includes('validar') && atendimento && (
        <PainelValidacao
          numero={senha.numero}
          atendimento={atendimento}
          desabilitado={enviando || !podeEscrever}
          onValidar={(aprovado, parecer) =>
            executar(
              () => api.validar(atendimento.id, { aprovado, parecer, versao }),
              aprovado
                ? 'Encerramento validado.'
                : 'Validação recusada. O parecer foi registrado e o atendimento continua pendente de validação.',
            )
          }
        />
      )}

      {(acoes.some((a) => a !== 'validar') || (recusado && tem('atendimento:editar'))) && (
        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-borda-suave bg-superficie py-3">
          {acoes.includes('iniciar') && (
            <Button
              disabled={enviando || !podeEscrever}
              aria-busy={enviando}
              onClick={() =>
                void executar(() => api.iniciar(senha.id, versao), 'Atendimento iniciado.')
              }
            >
              Iniciar atendimento
            </Button>
          )}
          {acoes.includes('pausar') && (
            <Button
              variante="secundario"
              disabled={enviando || !podeEscrever}
              onClick={() => setModal('pausa')}
            >
              Pausar
            </Button>
          )}
          {acoes.includes('retomar') && atendimento && (
            <Button
              disabled={enviando || !podeEscrever}
              aria-busy={enviando}
              onClick={() =>
                void executar(() => api.retomar(atendimento.id, versao), 'Atendimento retomado.')
              }
            >
              Retomar
            </Button>
          )}
          {(acoes.includes('encerrar') || (recusado && tem('atendimento:editar'))) && (
            <Button disabled={enviando || !podeEscrever} onClick={() => setModal('encerramento')}>
              {recusado ? 'Corrigir encerramento' : 'Encerrar atendimento'}
            </Button>
          )}
        </footer>
      )}

      {modal === 'pausa' && atendimento && (
        <ModalPausa
          numero={senha.numero}
          onFechar={() => setModal(null)}
          onConfirmar={(motivo) =>
            executar(() => api.pausar(atendimento.id, { motivo, versao }), 'Atendimento pausado.')
          }
        />
      )}
      {modal === 'encerramento' && atendimento && (
        <ModalEncerramento
          numero={senha.numero}
          inicial={
            recusado && detalhe
              ? { desfecho: detalhe.desfecho, observacoes: detalhe.observacoes }
              : undefined
          }
          onFechar={() => setModal(null)}
          onConfirmar={encerrar}
        />
      )}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-medium">{rotulo}</dt>
      <dd className="md:col-span-3">{children}</dd>
    </>
  );
}

/** Dado clínico: a consulta já foi registrada pela API (CONSULTAR_SENSIVEL, RNF-07). */
function DadosTriagem({ detalhe }: { detalhe: AtendimentoDetalhe }) {
  const { triagem } = detalhe;
  return (
    <section
      aria-labelledby="titulo-triagem"
      className="flex flex-col gap-3 rounded-lg border border-borda-suave p-4"
    >
      <h2 id="titulo-triagem" className="text-secao font-semibold">
        Dados da triagem
      </h2>
      <p className="rounded-md bg-superficie-elevada p-2 text-secundario">
        Acesso restrito: esta consulta fica registrada na trilha de auditoria (RNF-07).
      </p>
      <dl className="grid gap-x-4 gap-y-2 md:grid-cols-4">
        <Campo rotulo="Motivo">{triagem.motivo}</Campo>
        <Campo rotulo="Prioridade">{ROTULO_PRIORIDADE[triagem.prioridade]}</Campo>
        {triagem.justificativaClinica && (
          <Campo rotulo="Justificativa clínica">{triagem.justificativaClinica}</Campo>
        )}
        {triagem.observacoes && <Campo rotulo="Observações">{triagem.observacoes}</Campo>}
      </dl>
    </section>
  );
}

function RegistroAtendimento({ detalhe }: { detalhe: AtendimentoDetalhe }) {
  const pausaAberta = detalhe.pausas.find((p) => !p.retomadoEm);
  const temRegistro =
    detalhe.desfecho || detalhe.observacoes || detalhe.parecerSupervisor || detalhe.pausas.length;
  if (!temRegistro) return null;
  return (
    <section
      aria-labelledby="titulo-registro"
      className="flex flex-col gap-3 rounded-lg border border-borda-suave p-4"
    >
      <h2 id="titulo-registro" className="text-secao font-semibold">
        Registro do atendimento
      </h2>
      <dl className="grid gap-x-4 gap-y-2 md:grid-cols-4">
        {pausaAberta && (
          <Campo rotulo="Pausa">
            Desde {horaCurta(pausaAberta.pausadoEm)}
            {pausaAberta.motivo ? `: ${pausaAberta.motivo}` : ''}
          </Campo>
        )}
        {detalhe.desfecho && (
          <Campo rotulo="Desfecho">
            {ROTULO_DESFECHO[detalhe.desfecho]}
            {detalhe.encerradoEm && ` · encerrado às ${horaCurta(detalhe.encerradoEm)}`}
          </Campo>
        )}
        {detalhe.observacoes && <Campo rotulo="Observações">{detalhe.observacoes}</Campo>}
        {detalhe.parecerSupervisor && (
          <Campo rotulo="Parecer do supervisor">{detalhe.parecerSupervisor}</Campo>
        )}
        {detalhe.validadoPor && detalhe.validadoEm && (
          <Campo rotulo="Validado por">
            {detalhe.validadoPor} às {horaCurta(detalhe.validadoEm)}
          </Campo>
        )}
      </dl>
    </section>
  );
}

/** W-13, à direita: validação do supervisor (RN-11). Recusa exige parecer e mantém o status. */
function PainelValidacao({
  numero,
  atendimento,
  desabilitado,
  onValidar,
}: {
  numero: string;
  atendimento: AtendimentoResumo;
  desabilitado: boolean;
  onValidar: (aprovado: boolean, parecer: string | undefined) => Promise<unknown>;
}) {
  const id = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const [parecer, setParecer] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(aprovado: boolean) {
    const texto = parecer.trim();
    if (!aprovado && !texto) {
      setErro('Informe o parecer da recusa.');
      campo.current?.focus();
      return;
    }
    setErro(null);
    try {
      await onValidar(aprovado, texto || undefined);
      setParecer('');
    } catch (falha) {
      if (!(falha instanceof ErroApi && falha.status === 422)) throw falha;
      setErro(falha.campos.find((c) => c.campo === 'parecer')?.mensagem ?? falha.detail);
      campo.current?.focus();
    }
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-3 rounded-lg border-2 border-borda p-4"
    >
      <h2 id={`${id}-titulo`} className="text-secao font-semibold">
        Validação do supervisor
      </h2>
      <p>
        Senha {numero} · desfecho:{' '}
        {atendimento.desfecho ? ROTULO_DESFECHO[atendimento.desfecho] : 'não informado'}
      </p>
      <p className="text-texto-secundario">
        Responsável: {atendimento.estudante}
        {atendimento.encerradoEm && ` · encerrado às ${horaCurta(atendimento.encerradoEm)}`}
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-parecer`} className="font-medium">
          Parecer do supervisor
        </label>
        <p id={`${id}-ajuda`} className="text-secundario text-texto-secundario">
          Obrigatório para recusar. A recusa mantém o atendimento pendente de validação.
        </p>
        <textarea
          ref={campo}
          id={`${id}-parecer`}
          rows={3}
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={`${id}-ajuda${erro ? ` ${id}-erro` : ''}`}
          className={classeCampo}
        />
        {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variante="secundario" disabled={desabilitado} onClick={() => void enviar(false)}>
          Recusar validação
        </Button>
        <Button disabled={desabilitado} onClick={() => void enviar(true)}>
          Validar
        </Button>
      </div>
    </section>
  );
}
