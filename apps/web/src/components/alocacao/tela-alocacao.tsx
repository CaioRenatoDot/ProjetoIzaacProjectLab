'use client';

import {
  Button,
  classeCampo,
  classesBotao,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EtiquetaStatus,
  Modal,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { candidatosDoBloco, criarAlocacaoApi, escolhaInicial, temApto } from '@/lib/alocacao/api';
import {
  type BlocoAlocacao,
  type RecursoFaltante,
  type SugestoesAlocacao,
} from '@/lib/alocacao/tipos';
import { ErroApi } from '@/lib/api/cliente-http';
import { horaCurta } from '@/lib/fila/quadro';
import { type SenhaResumo } from '@/lib/fila/tipos';
import { useSessao } from '@/lib/sessao/sessao';

import { BlocoAlocacaoRecurso } from './bloco-alocacao';

interface Escolhas {
  estudante: string | null;
  supervisor: string | null;
  sala: string | null;
}

const ROTULO_FALTANTE: Record<RecursoFaltante, string> = {
  ESTUDANTE: 'Estudante/atendente',
  SUPERVISOR: 'Supervisor',
  SALA: 'Sala',
};

/** Mantém a escolha se ela continua apta; senão, volta para a sugestão (após recarga, T-10). */
function manterOuSugestao(anterior: string | null, bloco: BlocoAlocacao) {
  const ainda = candidatosDoBloco(bloco).find((c) => c.id === anterior && c.apto);
  return ainda ? ainda.id : escolhaInicial(bloco);
}

const nomeEscolhido = (bloco: BlocoAlocacao, id: string | null) =>
  candidatosDoBloco(bloco).find((c) => c.id === id)?.nome ?? null;

/** W-11 / T-10: alocação de estudante, supervisor e sala (UC-10). Não oferecida abaixo de 768 px. */
export function TelaAlocacao({ senhaId }: { senhaId: string }) {
  const { tem } = usePermissoes();
  if (!tem('alocacao:criar')) return <EstadoSemPermissao />;
  return (
    <>
      <p className="md:hidden">
        A alocação de recursos está disponível em telas a partir de 768 px. Use um computador ou
        tablet.
      </p>
      <div className="hidden md:block">
        <Alocacao senhaId={senhaId} />
      </div>
    </>
  );
}

function Alocacao({ senhaId }: { senhaId: string }) {
  const { cliente } = useSessao();
  const api = useMemo(() => criarAlocacaoApi(cliente), [cliente]);

  const senha = useQuery({
    queryKey: ['alocacao', senhaId, 'senha'],
    queryFn: () => api.senha(senhaId),
  });
  const sugestoes = useQuery({
    queryKey: ['alocacao', senhaId, 'sugestoes'],
    queryFn: () => api.sugestoes(senhaId),
    retry: false,
  });

  if (senha.isPending || sugestoes.isPending) {
    return <EstadoCarregando linhas={6} rotulo="Carregando os recursos disponíveis" />;
  }
  const erro = senha.error ?? sugestoes.error;
  if (erro) {
    if (erro instanceof ErroApi && erro.status === 403) return <EstadoSemPermissao />;
    if (erro instanceof ErroApi && erro.codigo === 'TRANSICAO_INVALIDA') {
      return (
        <div role="alert" className="flex flex-col items-start gap-3 py-6">
          <p>{erro.detail}</p>
          <Link href="/fila" className={classesBotao.secundario}>
            Voltar à fila
          </Link>
        </div>
      );
    }
    return (
      <EstadoErro
        mensagem="Não foi possível carregar os recursos disponíveis. Verifique a conexão e tente novamente."
        onTentarNovamente={() => {
          void senha.refetch();
          void sugestoes.refetch();
        }}
      />
    );
  }
  if (!senha.data || !sugestoes.data) return null;
  return (
    <FormularioAlocacao
      api={api}
      senha={senha.data}
      sugestoes={sugestoes.data}
      recarregar={async () => {
        await Promise.all([senha.refetch(), sugestoes.refetch()]);
      }}
    />
  );
}

function FormularioAlocacao({
  api,
  senha,
  sugestoes,
  recarregar,
}: {
  api: ReturnType<typeof criarAlocacaoApi>;
  senha: SenhaResumo;
  sugestoes: SugestoesAlocacao;
  recarregar: () => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const { podeEscrever } = useConexao();
  const idPendencia = useId();
  const alerta = useRef<HTMLDivElement>(null);
  const chave = useRef<string | null>(null);
  const emAndamento = useRef(false);

  const comSupervisor = sugestoes.supervisor.aplicavel;
  const [escolhas, setEscolhas] = useState<Escolhas>(() => ({
    estudante: escolhaInicial(sugestoes.estudante),
    supervisor: comSupervisor ? escolhaInicial(sugestoes.supervisor) : null,
    sala: escolhaInicial(sugestoes.sala),
  }));
  const [erro, setErro] = useState<string | null>(null);
  const [manter, setManter] = useState<RecursoFaltante | null>(null);

  // Alternativas recarregadas (409 RECURSO_INDISPONIVEL): escolha inapta volta para a sugestão.
  useEffect(() => {
    setEscolhas((anterior) => ({
      estudante: manterOuSugestao(anterior.estudante, sugestoes.estudante),
      supervisor: comSupervisor
        ? manterOuSugestao(anterior.supervisor, sugestoes.supervisor)
        : null,
      sala: manterOuSugestao(anterior.sala, sugestoes.sala),
    }));
  }, [sugestoes, comSupervisor]);

  useEffect(() => {
    if (erro) alerta.current?.focus();
  }, [erro]);

  const pendentes = [
    !escolhas.estudante && 'estudante',
    comSupervisor && !escolhas.supervisor && 'supervisor',
    !escolhas.sala && 'sala',
  ].filter(Boolean) as string[];

  const confirmar = useMutation({
    mutationFn: () => {
      chave.current ??= crypto.randomUUID();
      return api.confirmar(
        senha.id,
        {
          estudanteId: escolhas.estudante ?? '',
          supervisorId: comSupervisor ? escolhas.supervisor : null,
          salaId: escolhas.sala ?? '',
          versao: senha.versao,
        },
        chave.current,
      );
    },
    onSuccess: (alocacao) => {
      chave.current = null;
      void queryClient.invalidateQueries({ queryKey: ['fila'] });
      const recursos = [alocacao.estudante.nome, alocacao.supervisor?.nome, alocacao.sala.nome]
        .filter(Boolean)
        .join(', ');
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `Recursos alocados à senha ${senha.numero}: ${recursos}.`,
      });
      router.push('/fila');
    },
    onError: async (falha) => {
      if (!(falha instanceof ErroApi && falha.status === 0)) chave.current = null;
      const codigo = falha instanceof ErroApi ? falha.codigo : '';
      const detalhe =
        falha instanceof ErroApi
          ? falha.detail
          : 'Não foi possível confirmar. Verifique a conexão e tente novamente.';
      if (codigo === 'SUPERVISOR_INDISPONIVEL') {
        // RN-10: a senha foi para "Aguardando recurso" e a fila da especialidade foi bloqueada.
        void queryClient.invalidateQueries({ queryKey: ['fila'] });
        setErro(`${detalhe} A senha ficou aguardando recurso e a gestão foi notificada.`);
        return;
      }
      setErro(detalhe);
      // Recurso que deixou de estar disponível: recarrega as alternativas, sem confirmar (T-10).
      if (
        ['RECURSO_INDISPONIVEL', 'LIMITE_SUPERVISAO_ATINGIDO', 'VERSAO_DESATUALIZADA'].includes(
          codigo,
        )
      ) {
        await recarregar();
      }
    },
    onSettled: () => {
      emAndamento.current = false;
    },
  });

  function aoConfirmar() {
    if (emAndamento.current || pendentes.length > 0 || !podeEscrever) return;
    emAndamento.current = true;
    setErro(null);
    confirmar.mutate();
  }

  const resumo = [
    `Estudante: ${nomeEscolhido(sugestoes.estudante, escolhas.estudante) ?? 'pendente'}`,
    comSupervisor &&
      `Supervisor: ${nomeEscolhido(sugestoes.supervisor, escolhas.supervisor) ?? 'pendente'}`,
    `Sala: ${nomeEscolhido(sugestoes.sala, escolhas.sala) ?? 'pendente'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  /** Recurso faltante sugerido: o primeiro bloco sem nenhum apto, ou o primeiro sem escolha. */
  const faltante: RecursoFaltante = !temApto(sugestoes.estudante)
    ? 'ESTUDANTE'
    : comSupervisor && !temApto(sugestoes.supervisor)
      ? 'SUPERVISOR'
      : !temApto(sugestoes.sala)
        ? 'SALA'
        : !escolhas.estudante
          ? 'ESTUDANTE'
          : comSupervisor && !escolhas.supervisor
            ? 'SUPERVISOR'
            : 'SALA';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-pagina font-semibold">Alocação de recursos: senha {senha.numero}</h1>
        <p className="flex flex-wrap items-center gap-2 text-texto-secundario">
          {senha.chamadaEm ? `Chamada às ${horaCurta(senha.chamadaEm)}` : 'Ainda não chamada'} ·{' '}
          {senha.especialidade} · Paciente {senha.pacienteIniciais}
          <EtiquetaStatus status={senha.status} />
        </p>
      </header>

      {erro && (
        <div
          ref={alerta}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-1 rounded-md border-2 border-erro p-3 text-erro"
        >
          <span aria-hidden="true">⚠</span>
          <span>{erro}</span>
        </div>
      )}

      <div className={`grid gap-4 ${comSupervisor ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
        <BlocoAlocacaoRecurso
          titulo="1 · Estudante/atendente"
          nenhum="Nenhum estudante"
          bloco={sugestoes.estudante}
          escolhido={escolhas.estudante}
          onEscolher={(id) => setEscolhas((e) => ({ ...e, estudante: id }))}
          desabilitado={confirmar.isPending || !podeEscrever}
          onManterAguardando={() => setManter('ESTUDANTE')}
        />
        {comSupervisor && (
          <BlocoAlocacaoRecurso
            titulo="2 · Supervisor"
            nenhum="Nenhum supervisor"
            bloco={sugestoes.supervisor}
            escolhido={escolhas.supervisor}
            onEscolher={(id) => setEscolhas((e) => ({ ...e, supervisor: id }))}
            desabilitado={confirmar.isPending || !podeEscrever}
            onManterAguardando={() => setManter('SUPERVISOR')}
          />
        )}
        <BlocoAlocacaoRecurso
          titulo={comSupervisor ? '3 · Sala' : '2 · Sala'}
          nenhum="Nenhuma sala"
          bloco={sugestoes.sala}
          escolhido={escolhas.sala}
          onEscolher={(id) => setEscolhas((e) => ({ ...e, sala: id }))}
          desabilitado={confirmar.isPending || !podeEscrever}
          onManterAguardando={() => setManter('SALA')}
        />
      </div>

      {!comSupervisor && (
        <p className="rounded-md bg-superficie-elevada p-3">
          {senha.especialidade} não exige supervisão docente: a etapa de supervisor não se aplica a
          este atendimento (RN-07).
        </p>
      )}

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-borda-suave bg-superficie py-3">
        <p>
          <span className="font-medium">Resumo:</span> {resumo}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {pendentes.length > 0 && (
            <p id={idPendencia} className="mr-auto text-texto-secundario">
              Escolha {pendentes.join(', ')} para confirmar.
            </p>
          )}
          <Button
            variante="secundario"
            disabled={!podeEscrever || confirmar.isPending}
            onClick={() => setManter(faltante)}
          >
            Manter aguardando recurso
          </Button>
          <Link href="/fila" className={classesBotao.secundario}>
            Cancelar
          </Link>
          <Button
            disabled={pendentes.length > 0 || confirmar.isPending || !podeEscrever}
            aria-describedby={pendentes.length > 0 ? idPendencia : undefined}
            aria-busy={confirmar.isPending}
            onClick={aoConfirmar}
          >
            {confirmar.isPending ? 'Confirmando…' : 'Confirmar alocação'}
          </Button>
        </div>
      </footer>

      {manter !== null && (
        <ModalManterAguardando
          api={api}
          senha={senha}
          sugerido={manter}
          onFechar={() => setManter(null)}
          onMantida={() => {
            void queryClient.invalidateQueries({ queryKey: ['fila'] });
            router.push('/fila');
          }}
        />
      )}
    </div>
  );
}

/** "Manter aguardando recurso" (T-10): a senha vai para AGUARDANDO_RECURSO com o recurso faltante. */
function ModalManterAguardando({
  api,
  senha,
  sugerido,
  onFechar,
  onMantida,
}: {
  api: ReturnType<typeof criarAlocacaoApi>;
  senha: SenhaResumo;
  sugerido: RecursoFaltante;
  onFechar: () => void;
  onMantida: () => void;
}) {
  const id = useId();
  const mostrarToast = useToast();
  const [recurso, setRecurso] = useState<RecursoFaltante>(sugerido);
  const [observacao, setObservacao] = useState('');

  const manter = useMutation({
    mutationFn: () =>
      api.manterAguardando(senha.id, {
        recursoFaltante: recurso,
        observacao: observacao.trim() || undefined,
        versao: senha.versao,
      }),
    onSuccess: () => {
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `Senha ${senha.numero} mantida aguardando recurso (${ROTULO_FALTANTE[recurso].toLocaleLowerCase('pt-BR')}).`,
      });
      onMantida();
    },
    onError: (falha) =>
      mostrarToast({
        tipo: 'erro',
        mensagem:
          falha instanceof ErroApi
            ? falha.detail
            : 'Não foi possível registrar. Verifique a conexão e tente novamente.',
      }),
  });

  return (
    <Modal
      aberto
      onAbertoChange={(aberto) => !aberto && onFechar()}
      titulo={`Manter a senha ${senha.numero} aguardando recurso`}
      descricao="A senha fica em “Aguardando recurso”, com o recurso faltante registrado, e volta a ser alocada quando ele estiver disponível."
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-recurso`} className="font-medium">
          Recurso faltante
        </label>
        <select
          id={`${id}-recurso`}
          value={recurso}
          onChange={(e) => setRecurso(e.target.value as RecursoFaltante)}
          className={classeCampo}
        >
          {(Object.keys(ROTULO_FALTANTE) as RecursoFaltante[]).map((r) => (
            <option key={r} value={r}>
              {ROTULO_FALTANTE[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-observacao`} className="font-medium">
          Observação (opcional)
        </label>
        <textarea
          id={`${id}-observacao`}
          rows={3}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className={classeCampo}
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variante="secundario" onClick={onFechar}>
          Voltar
        </Button>
        <Button disabled={manter.isPending} onClick={() => manter.mutate()}>
          Manter aguardando
        </Button>
      </div>
    </Modal>
  );
}
