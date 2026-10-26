'use client';

import { type AtendimentoDetalhe, type Prioridade } from '@filas/contracts';
import {
  Button,
  classeCampo,
  classesBotao,
  ErroCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  useConexao,
  usePermissoes,
} from '@filas/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { criarAtendimentoApi } from '@/lib/atendimento/api';
import {
  criarEncaminhamentoApi,
  type Encaminhamento,
  type EncaminhamentoEntrada,
} from '@/lib/encaminhamento/api';
import { horaCurta } from '@/lib/fila/quadro';
import { useSessao } from '@/lib/sessao/sessao';

type Tipo = 'INTERNO' | 'EXTERNO';

const TIPO_DO_DESFECHO: Partial<Record<string, Tipo>> = {
  ENCAMINHAMENTO_INTERNO: 'INTERNO',
  ENCAMINHAMENTO_EXTERNO: 'EXTERNO',
};

const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: 'NORMAL', rotulo: 'Normal' },
  { valor: 'PREFERENCIAL', rotulo: 'Preferencial' },
  { valor: 'URGENTE', rotulo: 'Urgente' },
];

type Campo = 'especialidadeDestinoId' | 'instituicaoDestino' | 'motivo';
type Erros = Partial<Record<Campo, string>>;

/** W-14 / T-14: registro do encaminhamento definido como desfecho do atendimento (UC-14, UC-15). */
export function TelaEncaminhamento({ atendimentoId }: { atendimentoId: string }) {
  const { tem } = usePermissoes();
  if (!tem('encaminhamento:criar')) return <EstadoSemPermissao />;
  return <Encaminhar atendimentoId={atendimentoId} />;
}

function Encaminhar({ atendimentoId }: { atendimentoId: string }) {
  const { cliente } = useSessao();
  const atendimentos = useMemo(() => criarAtendimentoApi(cliente), [cliente]);
  const origem = useQuery({
    queryKey: ['encaminhamento', atendimentoId, 'origem'],
    queryFn: () => atendimentos.detalhe(atendimentoId),
  });

  if (origem.isPending) {
    return <EstadoCarregando linhas={5} rotulo="Carregando o atendimento de origem" />;
  }
  if (origem.error) {
    if (origem.error instanceof ErroApi && origem.error.status === 403) {
      return <EstadoSemPermissao />;
    }
    return (
      <EstadoErro
        mensagem="Não foi possível carregar o atendimento de origem. Verifique a conexão e tente novamente."
        onTentarNovamente={() => void origem.refetch()}
      />
    );
  }
  const tipo = origem.data.desfecho ? TIPO_DO_DESFECHO[origem.data.desfecho] : undefined;
  if (!tipo) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 py-6">
        <p>
          O desfecho do atendimento da senha {origem.data.numero} não é um encaminhamento. Registre
          o desfecho de encaminhamento no encerramento do atendimento.
        </p>
        <VoltarAoAtendimento senhaId={origem.data.senhaId} />
      </div>
    );
  }
  return <Formulario origem={origem.data} tipo={tipo} />;
}

function VoltarAoAtendimento({ senhaId }: { senhaId: string }) {
  return (
    <Link
      href={`/atendimento?senha=${encodeURIComponent(senhaId)}`}
      className={classesBotao.secundario}
    >
      Voltar ao atendimento
    </Link>
  );
}

function Formulario({ origem, tipo }: { origem: AtendimentoDetalhe; tipo: Tipo }) {
  const id = useId();
  const { cliente } = useSessao();
  const { podeEscrever } = useConexao();
  const api = useMemo(() => criarEncaminhamentoApi(cliente), [cliente]);
  const formulario = useRef<HTMLFormElement>(null);
  const alerta = useRef<HTMLDivElement>(null);

  const destinos = useQuery({
    queryKey: ['encaminhamento', 'destinos'],
    queryFn: () => api.destinos(),
    enabled: tipo === 'INTERNO',
  });

  const [especialidade, setEspecialidade] = useState('');
  const [instituicao, setInstituicao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState<Encaminhamento | null>(null);

  const destino = destinos.data?.dados.find((f) => f.especialidadeId === especialidade);

  useEffect(() => {
    if (falha) alerta.current?.focus();
  }, [falha]);

  function focarPrimeiroErro() {
    requestAnimationFrame(() =>
      formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  }

  function validar(): Erros {
    if (tipo === 'INTERNO') {
      return especialidade ? {} : { especialidadeDestinoId: 'Escolha a especialidade de destino.' };
    }
    return {
      ...(instituicao.trim() ? {} : { instituicaoDestino: 'Informe a instituição ou o serviço.' }),
      ...(motivo.trim() ? {} : { motivo: 'Informe o motivo do encaminhamento.' }),
    };
  }

  async function confirmar() {
    if (enviando || !podeEscrever) return;
    const locais = validar();
    setErros(locais);
    setFalha(null);
    if (Object.keys(locais).length) {
      focarPrimeiroErro();
      return;
    }
    const entrada: EncaminhamentoEntrada =
      tipo === 'INTERNO'
        ? {
            tipo,
            especialidadeDestinoId: especialidade,
            motivo: motivo.trim() || undefined,
            prioridadeSugerida: prioridade || undefined,
          }
        : {
            tipo,
            instituicaoDestino: instituicao.trim(),
            motivo: motivo.trim(),
            observacoes: observacoes.trim() || undefined,
          };
    setEnviando(true);
    try {
      setRegistrado(await api.registrar(origem.id, entrada));
    } catch (erro) {
      if (erro instanceof ErroApi && erro.codigo === 'ESPECIALIDADE_INATIVA') {
        // T-14: destino inativo impede o envio; a lista de destinos é recarregada.
        setEspecialidade('');
        setErros({ especialidadeDestinoId: erro.detail });
        void destinos.refetch();
        focarPrimeiroErro();
      } else if (erro instanceof ErroApi && erro.status === 422 && erro.campos.length) {
        setErros(Object.fromEntries(erro.campos.map((c) => [c.campo, c.mensagem])));
        focarPrimeiroErro();
      } else {
        setFalha(
          erro instanceof ErroApi
            ? erro.detail
            : 'Não foi possível registrar. Verifique a conexão e tente novamente.',
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  const props = (campo: Campo) => ({
    id: `${id}-${campo}`,
    'aria-invalid': erros[campo] ? true : undefined,
    'aria-describedby': erros[campo] ? `${id}-${campo}-erro` : undefined,
  });
  const erro = (campo: Campo) =>
    erros[campo] && <ErroCampo id={`${id}-${campo}-erro`}>{erros[campo]}</ErroCampo>;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-pagina font-semibold">
          {tipo === 'INTERNO' ? 'Encaminhamento interno' : 'Encaminhamento externo'}
        </h1>
        <p className="text-texto-secundario">
          Atendimento de origem: {origem.numero} · {origem.especialidade}
          {origem.encerradoEm && ` · encerrado às ${horaCurta(origem.encerradoEm)}`}
        </p>
      </header>

      <div role="status" aria-live="polite">
        {registrado && <Resultado encaminhamento={registrado} />}
      </div>

      {registrado ? (
        <div className="flex flex-wrap gap-3">
          <Link href="/fila" className={classesBotao.primario}>
            Voltar à fila
          </Link>
          <VoltarAoAtendimento senhaId={origem.senhaId} />
        </div>
      ) : (
        <form
          ref={formulario}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmar();
          }}
        >
          <p className="text-texto-secundario">
            {tipo === 'INTERNO'
              ? 'Gera automaticamente uma nova senha na fila da especialidade de destino, vinculada a este atendimento.'
              : 'É apenas registrado, sem gerar entrada de fila.'}
          </p>

          {falha && (
            <div
              ref={alerta}
              tabIndex={-1}
              role="alert"
              className="flex items-start gap-1 rounded-md border-2 border-erro p-3 text-erro"
            >
              <span aria-hidden="true">⚠</span>
              <span>{falha}</span>
            </div>
          )}

          {tipo === 'INTERNO' ? (
            <>
              <Grupo>
                <label htmlFor={`${id}-especialidadeDestinoId`} className="font-medium">
                  Especialidade de destino (obrigatório)
                </label>
                {destinos.isPending ? (
                  <EstadoCarregando linhas={1} rotulo="Carregando as especialidades" />
                ) : destinos.error ? (
                  <EstadoErro
                    mensagem="Não foi possível carregar as especialidades de destino."
                    onTentarNovamente={() => void destinos.refetch()}
                  />
                ) : (
                  <select
                    {...props('especialidadeDestinoId')}
                    value={especialidade}
                    onChange={(e) => {
                      setEspecialidade(e.target.value);
                      setErros((anteriores) => ({
                        ...anteriores,
                        especialidadeDestinoId: undefined,
                      }));
                    }}
                    className={classeCampo}
                  >
                    <option value="">Escolha a especialidade</option>
                    {destinos.data.dados.map((f) => (
                      <option key={f.id} value={f.especialidadeId}>
                        {f.especialidade}
                        {f.bloqueio.ativo ? ' (chamadas suspensas)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {erro('especialidadeDestinoId')}
                {destino?.bloqueio.ativo && (
                  <p
                    role="status"
                    className="flex items-start gap-1 rounded-md bg-alerta-fundo p-3 text-alerta-texto"
                  >
                    <span aria-hidden="true">⚠</span>
                    <span>
                      {destino.especialidade} está com as chamadas suspensas
                      {destino.bloqueio.motivo
                        ? ` (${destino.bloqueio.motivo.toLocaleLowerCase('pt-BR')})`
                        : ''}
                      . O encaminhamento continua permitido; a nova senha aguarda a regularização
                      (RN-10).
                    </span>
                  </p>
                )}
              </Grupo>
              <Grupo>
                <label htmlFor={`${id}-motivo`} className="font-medium">
                  Motivo do encaminhamento (opcional)
                </label>
                <textarea
                  {...props('motivo')}
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className={classeCampo}
                />
                {erro('motivo')}
              </Grupo>
              <Grupo>
                <label htmlFor={`${id}-prioridade`} className="font-medium">
                  Prioridade sugerida (opcional)
                </label>
                <select
                  id={`${id}-prioridade`}
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as Prioridade | '')}
                  className={classeCampo}
                >
                  <option value="">Sem sugestão</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>
              </Grupo>
            </>
          ) : (
            <>
              <Grupo>
                <label htmlFor={`${id}-instituicaoDestino`} className="font-medium">
                  Instituição ou serviço de destino (obrigatório)
                </label>
                <input
                  {...props('instituicaoDestino')}
                  type="text"
                  value={instituicao}
                  onChange={(e) => setInstituicao(e.target.value)}
                  className={classeCampo}
                />
                {erro('instituicaoDestino')}
              </Grupo>
              <Grupo>
                <label htmlFor={`${id}-motivo`} className="font-medium">
                  Motivo (obrigatório)
                </label>
                <textarea
                  {...props('motivo')}
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className={classeCampo}
                />
                {erro('motivo')}
              </Grupo>
              <Grupo>
                <label htmlFor={`${id}-observacoes`} className="font-medium">
                  Observações (opcional)
                </label>
                <textarea
                  id={`${id}-observacoes`}
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className={classeCampo}
                />
              </Grupo>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <VoltarAoAtendimento senhaId={origem.senhaId} />
            <Button type="submit" disabled={enviando || !podeEscrever} aria-busy={enviando}>
              {enviando ? 'Registrando…' : 'Confirmar encaminhamento'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Grupo({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}

/** Confirmação anunciada por `aria-live` (T-14): número da nova senha e fila de destino. */
function Resultado({ encaminhamento }: { encaminhamento: Encaminhamento }) {
  const { senhaGerada } = encaminhamento;
  return (
    <div className="flex flex-col gap-2 rounded-md border-2 border-sucesso p-3">
      <p className="font-semibold">
        {encaminhamento.tipo === 'INTERNO' && senhaGerada
          ? `Encaminhamento registrado. Nova senha ${senhaGerada.numero} na fila de ${encaminhamento.especialidadeDestino ?? senhaGerada.especialidade}.`
          : `Encaminhamento externo para ${encaminhamento.instituicaoDestino ?? 'o destino informado'} registrado, sem gerar entrada de fila.`}
      </p>
      {encaminhamento.avisos.map((aviso) => (
        <p key={aviso.codigo} className="flex items-start gap-1 text-alerta-texto">
          <span aria-hidden="true">⚠</span>
          <span>{aviso.mensagem}</span>
        </p>
      ))}
    </div>
  );
}
