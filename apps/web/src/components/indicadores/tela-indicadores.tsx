'use client';

import type { IndicadoresResumo } from '@filas/contracts';
import {
  Button,
  classeCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  Permitido,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ErroApi } from '@/lib/api/cliente-http';
import { baixarArquivo } from '@/lib/arquivo';
import {
  consultaIndicadores,
  consultarIndicadores,
  filtrosIniciais,
  validarFiltros,
  type FiltrosIndicadores,
} from '@/lib/indicadores/consulta';
import { useSessao } from '@/lib/sessao/sessao';
import { VolumeIndicadores } from './volume-indicadores';

export function TelaIndicadores() {
  const { tem } = usePermissoes();
  if (!tem('indicadores:consultar')) return <EstadoSemPermissao />;
  return (
    <>
      <div className="py-10 text-center md:hidden">
        <p className="text-secao font-semibold">Indicadores indisponíveis nesta tela</p>
        <p>Abra em um computador ou tablet com pelo menos 768 px de largura.</p>
      </div>
      <div className="hidden md:block">
        <Painel />
      </div>
    </>
  );
}

function Painel() {
  const { cliente } = useSessao();
  const toast = useToast();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [rascunho, setRascunho] = useState(filtros);
  const [tabela, setTabela] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [opcoes, setOpcoes] = useState<{ especialidadeId: string; especialidade: string }[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const dados = useQuery({
    queryKey: ['indicadores', filtros],
    queryFn: () => consultarIndicadores(cliente, filtros),
  });
  useEffect(() => {
    if (dados.data?.volume.series.length) setOpcoes(dados.data.volume.series);
  }, [dados.data]);
  const resumo = dados.data?.resumo;
  const series =
    dados.data?.volume.series.filter(
      (s) => !filtros.especialidadeId || s.especialidadeId === filtros.especialidadeId,
    ) ?? [];

  const exportar = useMutation({
    mutationFn: (aplicados: FiltrosIndicadores) =>
      cliente.requisitar<Blob>(
        '/indicadores/exportacao' + consultaIndicadores(aplicados) + '&formato=csv',
        { resposta: 'blob' },
      ),
    onSuccess: (arquivo, aplicados) => {
      baixarArquivo(arquivo, 'indicadores-' + aplicados.de + '-a-' + aplicados.ate + '.csv');
      toast({ tipo: 'sucesso', mensagem: 'Exportação concluída.' });
    },
    onError: (erro) =>
      toast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi && erro.status === 403
            ? 'Seu perfil não tem permissão para exportar indicadores.'
            : 'Não foi possível exportar. Verifique a conexão e tente novamente.',
      }),
  });

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const validacao = validarFiltros(rascunho);
    if (!validacao.success) {
      const falhas = Object.fromEntries(
        validacao.error.issues.map((i) => [String(i.path[0]), i.message]),
      );
      setErros(falhas);
      form.current
        ?.querySelector<HTMLElement>('[name="' + String(validacao.error.issues[0]?.path[0]) + '"]')
        ?.focus();
      return;
    }
    setErros({});
    setFiltros({ ...rascunho });
  }
  function limpar() {
    const inicial = filtrosIniciais();
    setRascunho(inicial);
    setFiltros(inicial);
    setErros({});
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-pagina font-semibold">Indicadores de atendimento</h1>
          <p className="text-texto-secundario">Resultados agregados por período e especialidade.</p>
        </div>
        <Permitido permissao="indicadores:exportar">
          <Button
            variante="secundario"
            disabled={
              exportar.isPending || dados.isFetching || dados.isError || !resumo || resumo.semDados
            }
            onClick={() => exportar.mutate({ ...filtros })}
          >
            {exportar.isPending ? 'Exportando…' : 'Exportar resultado'}
          </Button>
        </Permitido>
      </header>
      <form
        ref={form}
        role="search"
        aria-label="Filtrar indicadores"
        noValidate
        onSubmit={aplicar}
        className="flex flex-col gap-4 rounded-lg border border-borda-suave bg-superficie p-4"
      >
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {(['de', 'ate'] as const).map((campo) => (
            <div key={campo} className="flex flex-col gap-1">
              <label htmlFor={'indicadores-' + campo} className="font-medium">
                {campo === 'de' ? 'De' : 'Até'}
              </label>
              <input
                id={'indicadores-' + campo}
                name={campo}
                type="date"
                value={rascunho[campo]}
                onChange={(e) => setRascunho({ ...rascunho, [campo]: e.target.value })}
                className={classeCampo}
                aria-invalid={!!erros[campo]}
                aria-describedby={erros[campo] ? 'erro-' + campo : undefined}
              />
              {erros[campo] && (
                <p id={'erro-' + campo} className="text-erro">
                  {erros[campo]}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label htmlFor="indicadores-especialidade" className="font-medium">
              Especialidade
            </label>
            <select
              id="indicadores-especialidade"
              name="especialidadeId"
              className={classeCampo}
              value={rascunho.especialidadeId}
              onChange={(e) => setRascunho({ ...rascunho, especialidadeId: e.target.value })}
            >
              <option value="">Todas</option>
              {opcoes.map((o) => (
                <option key={o.especialidadeId} value={o.especialidadeId}>
                  {o.especialidade}
                </option>
              ))}
            </select>
            <p className="text-secundario text-texto-secundario">
              Especialidades com movimento no período consultado.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="indicadores-turno" className="font-medium">
              Turno
            </label>
            <select
              id="indicadores-turno"
              className={classeCampo}
              value={rascunho.turno}
              onChange={(e) => setRascunho({ ...rascunho, turno: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="MANHA">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="NOITE">Noite</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-secundario text-texto-secundario">
            Limpar retorna ao mês atual, com todas as especialidades e turnos.
          </p>
          <div className="flex gap-3">
            <Button variante="secundario" onClick={limpar}>
              Limpar filtros
            </Button>
            <Button type="submit">Aplicar filtros</Button>
          </div>
        </div>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {dados.isPending || dados.isFetching ? (
          <EstadoCarregando linhas={6} rotulo="Carregando indicadores" />
        ) : dados.isError ? (
          dados.error instanceof ErroApi && dados.error.status === 403 ? (
            <EstadoSemPermissao />
          ) : (
            <EstadoErro
              mensagem="Não foi possível carregar os indicadores. Verifique a conexão e tente novamente."
              onTentarNovamente={() => {
                void dados.refetch();
              }}
            />
          )
        ) : resumo?.semDados ? (
          <EstadoVazio
            titulo="Sem dados disponíveis"
            descricao="Tente outro período, especialidade ou turno."
          />
        ) : resumo ? (
          <>
            <p className="mb-4 text-texto-secundario">
              Período consultado: {resumo.periodo.de.split('-').reverse().join('/')} a{' '}
              {resumo.periodo.ate.split('-').reverse().join('/')}.{' '}
              {filtros.turno
                ? { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite' }[
                    filtros.turno as 'MANHA' | 'TARDE' | 'NOITE'
                  ]
                : 'Todos os turnos'}
              .
            </p>
            <Cartoes resumo={resumo} />
            {resumo.amostraPequena && (
              <p className="my-4 rounded-md bg-alerta-fundo p-4 text-alerta-texto">
                Volume baixo no período: a média pode não ser representativa.
              </p>
            )}
            <div className="mt-6">
              <VolumeIndicadores series={series} tabela={tabela} onTabela={setTabela} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Cartoes({ resumo }: { resumo: IndicadoresResumo }) {
  const n = (valor: number) => valor.toLocaleString('pt-BR');
  const minutos = (valor: number | null) => (valor === null ? 'Sem estimativa' : n(valor) + ' min');
  const itens = [
    ['Tempo médio de espera', minutos(resumo.tempoMedioEsperaMinutos)],
    ['Tempo médio de atendimento', minutos(resumo.tempoMedioAtendimentoMinutos)],
    ['Pacientes atendidos', n(resumo.pacientesAtendidos)],
    ['Taxa de ausência', n(resumo.taxaAusencia) + '%'],
    ['Desistências', n(resumo.desistencias)],
  ];
  return (
    <section aria-label="Resumo dos seis indicadores">
      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-lg border border-borda-suave bg-superficie p-4">
            <dt className="text-texto-secundario">{rotulo}</dt>
            <dd className="mt-2 text-pagina font-semibold tabular-nums">{valor}</dd>
          </div>
        ))}
        <div className="rounded-lg border border-borda-suave bg-superficie p-4">
          <dt className="text-texto-secundario">Volume de atendimentos por especialidade</dt>
          <dd className="mt-2">
            {resumo.atendimentosPorEspecialidade.length ? (
              <ul className="flex flex-col gap-1">
                {resumo.atendimentosPorEspecialidade.map((s) => (
                  <li key={s.especialidadeId} className="flex justify-between gap-2">
                    <span>{s.especialidade}</span>
                    <strong>{n(s.total)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              'Nenhum atendimento concluído.'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
