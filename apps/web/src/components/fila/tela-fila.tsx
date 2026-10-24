'use client';

import { TipoAtendimento, type TipoAtendimento as TipoAtendimentoValor } from '@filas/contracts';
import {
  BannerConexao,
  Button,
  classeCampo,
  ConexaoProvider,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  ModalConfirmacao,
  Permitido,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { criarFilaApi } from '@/lib/fila/api';
import {
  agruparPorColuna,
  COLUNAS_QUADRO,
  horaCurta,
  novasChamadas,
  proximaFuraFila,
  ROTULO_TIPO_ATENDIMENTO,
  textoMinutos,
} from '@/lib/fila/quadro';
import { type Fila, type QuadroFila, type SenhaResumo } from '@/lib/fila/tipos';
import { PREFIXO_ESTADO_LOCAL } from '@/lib/sessao/estado-local';
import { useSessao } from '@/lib/sessao/sessao';

import { CartaoSenha, useAgora } from './cartao-senha';
import { PainelSenha } from './painel-senha';
import { useTempoRealFila } from './use-tempo-real-fila';

/** Revalidação por HTTP mesmo com tempo real (`docs/04` §7, degradação). */
export const REVALIDACAO_MS = 30_000;

const CHAVE_FILA = `${PREFIXO_ESTADO_LOCAL}fila-selecionada`;

function lerFilaSalva() {
  try {
    return window.sessionStorage.getItem(CHAVE_FILA) ?? '';
  } catch {
    return '';
  }
}

function salvarFila(id: string) {
  try {
    window.sessionStorage.setItem(CHAVE_FILA, id);
  } catch {
    // Sem storage disponível, a escolha vale só enquanto a tela estiver aberta.
  }
}

/** W-08 / T-09: painel de fila da equipe (UC-08, UC-09). */
export function TelaFila() {
  const { tem } = usePermissoes();
  if (!tem('fila:consultar')) return <EstadoSemPermissao />;
  return <PainelFila />;
}

function PainelFila() {
  const { cliente } = useSessao();
  const api = useMemo(() => criarFilaApi(cliente), [cliente]);
  const queryClient = useQueryClient();
  const [anuncio, setAnuncio] = useState('');

  const [filaEscolhida, setFilaEscolhida] = useState(lerFilaSalva);
  const [tipo, setTipo] = useState<TipoAtendimentoValor | ''>('');

  const filas = useQuery({
    queryKey: ['fila', 'lista'],
    queryFn: api.listarFilas,
    refetchInterval: REVALIDACAO_MS,
  });
  const lista = filas.data?.dados ?? [];
  const filaId = lista.some((f) => f.id === filaEscolhida) ? filaEscolhida : (lista[0]?.id ?? '');

  const quadro = useQuery({
    queryKey: ['fila', 'quadro', filaId, tipo],
    queryFn: () => api.quadro(filaId, tipo),
    enabled: filaId !== '',
    refetchInterval: REVALIDACAO_MS,
    placeholderData: keepPreviousData,
  });

  const atualizar = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['fila'] }),
    [queryClient],
  );

  // Chamadas novas entre leituras (de outro atendente, por exemplo) são anunciadas (T-09).
  const leituraAnterior = useRef<{ filaId: string; dados: SenhaResumo[] } | null>(null);
  useEffect(() => {
    const atual = quadro.data;
    if (!atual) return;
    const anterior = leituraAnterior.current;
    if (anterior?.filaId === atual.fila.id) {
      const novas = novasChamadas(anterior.dados, atual.dados);
      if (novas.length > 0) {
        setAnuncio(`Nova chamada: ${novas.map((s) => `senha ${s.numero}`).join(', ')}.`);
      }
    }
    leituraAnterior.current = { filaId: atual.fila.id, dados: atual.dados };
  }, [quadro.data]);

  const { conectado } = useTempoRealFila(quadro.data?.fila.especialidadeId, (senha) =>
    setAnuncio(`Nova chamada: senha ${senha.numero}.`),
  );

  function escolherFila(id: string) {
    salvarFila(id);
    setFilaEscolhida(id);
  }

  return (
    <ConexaoProvider conectado={conectado}>
      <div className="flex flex-col gap-4">
        <BannerConexao />
        <h1 className="text-pagina font-semibold">Painel de fila</h1>

        <p role="status" aria-live="polite" aria-label="Atualizações da fila" className="sr-only">
          {anuncio}
        </p>

        {filas.isPending ? (
          <EstadoCarregando linhas={6} rotulo="Carregando as filas" />
        ) : filas.isError && !filas.data ? (
          filas.error instanceof ErroApi && filas.error.status === 403 ? (
            <EstadoSemPermissao />
          ) : (
            <EstadoErro
              mensagem="Não foi possível carregar as filas. Verifique a conexão e tente novamente."
              onTentarNovamente={() => void filas.refetch()}
            />
          )
        ) : lista.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma fila ativa"
            descricao="Peça à administração para configurar a fila da especialidade."
          />
        ) : (
          <>
            <BarraDeContexto
              filas={lista}
              filaId={filaId}
              onFila={escolherFila}
              tipo={tipo}
              onTipo={setTipo}
              quadro={quadro.data}
              onAtualizar={atualizar}
              atualizando={quadro.isFetching}
            />
            <Avisos filas={lista} filaId={filaId} quadro={quadro.data} />
            {quadro.isPending ? (
              <EstadoCarregando linhas={6} rotulo="Carregando o quadro de senhas" />
            ) : quadro.isError && !quadro.data ? (
              <EstadoErro
                mensagem="Não foi possível carregar as senhas da fila. Verifique a conexão e tente novamente."
                onTentarNovamente={() => void quadro.refetch()}
              />
            ) : quadro.data ? (
              <Quadro
                api={api}
                quadro={quadro.data}
                onAtualizar={atualizar}
                onAnunciar={setAnuncio}
              />
            ) : null}
          </>
        )}
      </div>
    </ConexaoProvider>
  );
}

function BarraDeContexto({
  filas,
  filaId,
  onFila,
  tipo,
  onTipo,
  quadro,
  onAtualizar,
  atualizando,
}: {
  filas: Fila[];
  filaId: string;
  onFila: (id: string) => void;
  tipo: TipoAtendimentoValor | '';
  onTipo: (tipo: TipoAtendimentoValor | '') => void;
  quadro: QuadroFila | undefined;
  onAtualizar: () => void;
  atualizando: boolean;
}) {
  const id = useId();
  const metricas = quadro?.metricas;
  const contadores: readonly [string, string][] = metricas
    ? [
        ['Aguardando', String(metricas.aguardando)],
        ['Chamadas', String(metricas.chamadas)],
        ['Em atendimento', String(metricas.emAtendimento)],
        ['Ausências hoje', String(metricas.ausenciasHoje)],
        [
          'Tempo médio de espera',
          metricas.tempoMedioEsperaMinutos === null
            ? '—'
            : textoMinutos(metricas.tempoMedioEsperaMinutos),
        ],
      ]
    : [];

  return (
    <section
      aria-label="Contexto da fila"
      className="flex flex-col gap-4 rounded-lg border border-borda-suave p-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-fila`} className="font-medium">
            Especialidade
          </label>
          <select
            id={`${id}-fila`}
            value={filaId}
            onChange={(e) => onFila(e.target.value)}
            className={classeCampo}
          >
            {filas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.especialidade}
                {f.bloqueio.ativo ? ' (chamadas bloqueadas)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-tipo`} className="font-medium">
            Tipo de atendimento
          </label>
          <select
            id={`${id}-tipo`}
            value={tipo}
            onChange={(e) => onTipo(e.target.value as TipoAtendimentoValor | '')}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {TipoAtendimento.options.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_ATENDIMENTO[t]}
              </option>
            ))}
          </select>
        </div>
        {quadro && <ChamarProxima quadro={quadro} />}
      </div>

      {metricas && (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {contadores.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex flex-col rounded-md bg-superficie-elevada p-3">
              <dt className="text-secundario text-texto-secundario">{rotulo}</dt>
              <dd className="text-secao font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {quadro && (
        <div className="flex flex-wrap items-center gap-3 text-secundario text-texto-secundario">
          <span>
            Última sincronização: {new Date(quadro.sincronizadoEm).toLocaleTimeString('pt-BR')}
          </span>
          <Button variante="secundario" onClick={onAtualizar} aria-busy={atualizando}>
            Atualizar
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * "Chamar próxima" por especialidade (UC-09). Sem permissão, não aparece; com permissão e fila
 * bloqueada ou vazia, aparece desabilitado com a causa em texto (RN-10, nota D-27).
 * A `Idempotency-Key` é a mesma até a chamada terminar: duplo clique não chama duas senhas.
 */
function ChamarProxima({ quadro }: { quadro: QuadroFila }) {
  const { cliente } = useSessao();
  const api = useMemo(() => criarFilaApi(cliente), [cliente]);
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const { podeEscrever } = useConexao();
  const idCausa = useId();
  const chave = useRef<string | null>(null);
  // Trava síncrona: o `isPending` só aparece no render seguinte, e o duplo clique é mais rápido.
  const emAndamento = useRef(false);
  const [urgente, setUrgente] = useState<SenhaResumo | null>(null);

  const chamar = useMutation({
    mutationFn: () => {
      chave.current ??= crypto.randomUUID();
      return api.chamarProxima(quadro.fila.id, chave.current);
    },
    onSuccess: (resultado) => {
      chave.current = null;
      // O quadro reflete a chamada na hora: um segundo clique já vê a fila sem essa senha.
      queryClient.setQueriesData<QuadroFila>(
        { queryKey: ['fila', 'quadro', quadro.fila.id] },
        (atual) => {
          const anterior = atual?.dados.find((s) => s.id === resultado.senha.id);
          if (!atual || anterior?.status !== 'AGUARDANDO') return atual;
          return {
            ...atual,
            dados: atual.dados.map((s) => (s.id === resultado.senha.id ? resultado.senha : s)),
            metricas: {
              ...atual.metricas,
              aguardando: Math.max(0, atual.metricas.aguardando - 1),
              chamadas: atual.metricas.chamadas + 1,
            },
          };
        },
      );
      const porUrgencia = resultado.furouFilaPorUrgencia ? ' por urgência clínica (RN-03)' : '';
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `Senha ${resultado.senha.numero} chamada${porUrgencia}.`,
      });
    },
    onError: (erro) => {
      // Falha de rede mantém a chave: o reenvio devolve a mesma chamada, sem duplicar.
      if (!(erro instanceof ErroApi && erro.status === 0)) chave.current = null;
      mostrarToast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi
            ? erro.detail
            : 'Não foi possível chamar. Verifique a conexão e tente novamente.',
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fila'] });
      emAndamento.current = false;
    },
  });

  const { fila, metricas } = quadro;
  const causa = !podeEscrever
    ? 'Conexão perdida: as chamadas estão pausadas até a conexão voltar.'
    : fila.bloqueio.ativo
      ? `Chamadas bloqueadas: ${fila.especialidade} está sem supervisor habilitado disponível (RN-10).`
      : metricas.aguardando === 0
        ? 'Nenhuma senha aguardando nesta fila.'
        : null;

  function iniciarChamada() {
    if (emAndamento.current) return;
    emAndamento.current = true;
    chamar.mutate();
  }

  /** Lê o cache, não o render: depois de uma chamada ele já tem a fila atualizada. */
  function semSenhaAguardando() {
    return queryClient
      .getQueriesData<QuadroFila>({ queryKey: ['fila', 'quadro', quadro.fila.id] })
      .some(([, dados]) => dados?.metricas.aguardando === 0);
  }

  function aoChamar() {
    if (emAndamento.current || semSenhaAguardando()) return;
    const proximaUrgente = proximaFuraFila(quadro.dados);
    if (proximaUrgente) setUrgente(proximaUrgente);
    else iniciarChamada();
  }

  return (
    <Permitido permissao="fila:chamar">
      <div className="hidden flex-col gap-1 md:ml-auto md:flex md:items-end">
        <Button
          disabled={causa !== null || chamar.isPending}
          aria-describedby={causa ? idCausa : undefined}
          aria-busy={chamar.isPending}
          onClick={aoChamar}
        >
          {chamar.isPending ? 'Chamando…' : 'Chamar próxima'}
        </Button>
        {causa && (
          <p id={idCausa} className="max-w-xs text-secundario text-texto-secundario md:text-right">
            {causa}
          </p>
        )}
      </div>
      <ModalConfirmacao
        aberto={urgente !== null}
        onAbertoChange={(aberto) => !aberto && setUrgente(null)}
        titulo="Chamar senha urgente"
        descricao={
          urgente
            ? `A próxima senha, ${urgente.numero}, é urgente e passa à frente de senhas que chegaram antes. A ordem padrão é alterada por urgência clínica (RN-03).`
            : ''
        }
        rotuloConfirmar="Chamar mesmo assim"
        onConfirmar={() => {
          setUrgente(null);
          iniciarChamada();
        }}
      />
    </Permitido>
  );
}

/** Faixa de avisos (T-09): bloqueios por especialidade (P-04) e SLA excedido, empilhados. */
function Avisos({
  filas,
  filaId,
  quadro,
}: {
  filas: Fila[];
  filaId: string;
  quadro: QuadroFila | undefined;
}) {
  const bloqueadas = filas.filter((f) => f.bloqueio.ativo);
  const comSla = quadro?.dados.filter((s) => s.slaExcedido) ?? [];
  if (bloqueadas.length === 0 && comSla.length === 0) return null;

  return (
    <ul aria-label="Avisos" className="flex flex-col gap-2">
      {bloqueadas.map((f) => (
        <li
          key={f.id}
          className={`flex items-start gap-2 rounded-md p-3 ${f.id === filaId ? 'border-2 border-erro bg-alerta-fundo text-alerta-texto' : 'border border-borda-suave bg-superficie-elevada'}`}
        >
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>{f.especialidade}</strong> sem supervisor habilitado disponível: chamadas
            bloqueadas (RN-10)
            {f.bloqueio.desde ? ` desde ${horaCurta(f.bloqueio.desde)}` : ''}. A gestão foi
            alertada; as demais especialidades seguem operando.
          </span>
        </li>
      ))}
      {quadro && comSla.length > 0 && (
        <li className="flex items-start gap-2 rounded-md border border-erro p-3 text-erro">
          <span aria-hidden="true">⚠</span>
          <span>
            {comSla.length === 1 ? '1 senha aguarda' : `${comSla.length} senhas aguardam`} há mais
            de {quadro.fila.slaMinutos} min em {quadro.fila.especialidade} (SLA excedido):{' '}
            {comSla.map((s) => s.numero).join(', ')}.
          </span>
        </li>
      )}
    </ul>
  );
}

/**
 * Quadro por status (T-09), na ordem da API (RN-04). Cada coluna é uma região rotulada.
 * Abaixo de 1280 px: "Aguardando" e uma segunda coluna escolhida no seletor.
 */
function Quadro({
  api,
  quadro,
  onAtualizar,
  onAnunciar,
}: {
  api: ReturnType<typeof criarFilaApi>;
  quadro: QuadroFila;
  onAtualizar: () => void;
  onAnunciar: (texto: string) => void;
}) {
  const id = useId();
  const agora = useAgora();
  const [segunda, setSegunda] = useState('chamada');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const colunas = agruparPorColuna(quadro.dados);
  const selecionada = quadro.dados.find((s) => s.id === selecionadaId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-1 xl:hidden">
        <label htmlFor={`${id}-coluna`} className="font-medium">
          Segunda coluna
        </label>
        <select
          id={`${id}-coluna`}
          value={segunda}
          onChange={(e) => setSegunda(e.target.value)}
          className={`${classeCampo} max-w-xs`}
        >
          {COLUNAS_QUADRO.slice(1).map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {colunas.map(({ coluna, senhas }) => {
          const visivel = coluna.id === 'aguardando' || coluna.id === segunda;
          return (
            <section
              key={coluna.id}
              aria-labelledby={`${id}-${coluna.id}`}
              className={`${visivel ? 'flex' : 'hidden xl:flex'} min-w-0 flex-col gap-2 rounded-lg bg-superficie-elevada p-3`}
            >
              <h2 id={`${id}-${coluna.id}`} className="font-semibold">
                {coluna.rotulo} <span className="font-normal">({senhas.length})</span>
              </h2>
              {senhas.length === 0 ? (
                <p className="text-texto-secundario">{coluna.vazio}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {senhas.map((senha) => (
                    <li key={senha.id}>
                      <CartaoSenha
                        senha={senha}
                        agora={agora}
                        onAbrir={(s) => setSelecionadaId(s.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {selecionada && (
        <PainelSenha
          api={api}
          senha={selecionada}
          agora={agora}
          aberto
          onAbertoChange={(aberto) => !aberto && setSelecionadaId(null)}
          onAtualizar={onAtualizar}
          onAnunciar={onAnunciar}
        />
      )}
    </>
  );
}
