'use client';

import {
  Button,
  classeCampo,
  classesBotao,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  Modal,
  ModalConfirmacao,
  Permitido,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useId, useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import {
  type Direcao,
  type EstadoLista,
  ESTADO_INICIAL,
  lerEstadoSalvo,
  montarConsulta,
  salvarEstado,
  temFiltroAtivo,
} from '@/lib/cadastros/consulta';
import {
  type ColunaCadastro,
  type EntidadeCadastro,
  entidadeCadastro,
  type FiltroCadastro,
  type OpcaoFiltro,
  type RegistroCadastro,
  type SlugCadastro,
  textoNenhum,
  textoTotal,
} from '@/lib/cadastros/entidades';
import { type Especialidade, type Pagina } from '@/lib/cadastros/tipos';
import { useSessao } from '@/lib/sessao/sessao';

import { Paginacao } from '../paginacao';
import { NavegacaoCadastros } from './navegacao-cadastros';

type Entidade = EntidadeCadastro<RegistroCadastro>;
type Coluna = ColunaCadastro<RegistroCadastro>;

const ROTULO_DIRECAO: Record<Direcao, string> = { asc: 'crescente', desc: 'decrescente' };

/** W-03 / T-03: lista genérica dos cadastros base, configurada por entidade (`lib/cadastros`). */
export function ListaCadastro({ slug }: { slug: SlugCadastro }) {
  const { tem } = usePermissoes();
  const entidade = entidadeCadastro(slug);
  if (!entidade || !tem('cadastros:consultar')) return <EstadoSemPermissao />;
  return <Lista key={slug} entidade={entidade} />;
}

function Lista({ entidade }: { entidade: Entidade }) {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const { podeEscrever } = useConexao();
  const prefixo = useId();

  const [estado, setEstadoLocal] = useState<EstadoLista>(() => lerEstadoSalvo(entidade.slug));
  const [buscaDigitada, setBuscaDigitada] = useState(estado.busca);
  const [detalhe, setDetalhe] = useState<RegistroCadastro | null>(null);
  const [aExcluir, setAExcluir] = useState<RegistroCadastro | null>(null);
  const [comVinculo, setComVinculo] = useState<{
    registro: RegistroCadastro;
    motivo: string;
  } | null>(null);

  function atualizar(novo: EstadoLista) {
    salvarEstado(entidade.slug, novo);
    setEstadoLocal(novo);
  }

  const consulta = montarConsulta(estado);
  const lista = useQuery({
    queryKey: ['cadastros', entidade.slug, consulta],
    queryFn: () => cliente.requisitar<Pagina<RegistroCadastro>>(`${entidade.endpoint}${consulta}`),
    placeholderData: keepPreviousData,
  });

  const recarregar = () =>
    queryClient.invalidateQueries({ queryKey: ['cadastros', entidade.slug] });
  const nome = (registro: RegistroCadastro) => entidade.nomeRegistro(registro);

  const excluir = useMutation({
    mutationFn: (registro: RegistroCadastro) =>
      cliente.requisitar(`${entidade.endpoint}/${registro.id}`, { metodo: 'DELETE' }),
    onSuccess: (_, registro) => {
      setAExcluir(null);
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `${nome(registro)} foi ${entidade.feminino ? 'excluída' : 'excluído'} do cadastro.`,
      });
      void recarregar();
    },
    onError: (erro, registro) => {
      setAExcluir(null);
      if (erro instanceof ErroApi && erro.codigo === 'VINCULO_ATIVO') {
        setComVinculo({ registro, motivo: erro.detail });
        return;
      }
      mostrarToast({ tipo: 'erro', mensagem: mensagemDeErro(erro) });
    },
  });

  const inativar = useMutation({
    mutationFn: (registro: RegistroCadastro) =>
      cliente.requisitar(`${entidade.endpoint}/${registro.id}`, {
        metodo: 'PATCH',
        corpo: { [entidade.campoAtivo]: false },
      }),
    onSuccess: (_, registro) => {
      setComVinculo(null);
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `${nome(registro)} foi ${entidade.feminino ? 'inativada' : 'inativado'}.`,
      });
      void recarregar();
    },
    onError: (erro) => mostrarToast({ tipo: 'erro', mensagem: mensagemDeErro(erro) }),
  });

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    atualizar({ ...estado, busca: buscaDigitada, pagina: 1 });
  }

  function filtrar(parametro: string, valor: string) {
    atualizar({ ...estado, filtros: { ...estado.filtros, [parametro]: valor }, pagina: 1 });
  }

  function limparFiltros() {
    setBuscaDigitada('');
    atualizar({ ...ESTADO_INICIAL, ordenar: estado.ordenar, direcao: estado.direcao });
  }

  function ordenar(coluna: Coluna) {
    if (!coluna.ordenar) return;
    const direcao: Direcao =
      estado.ordenar === coluna.ordenar && estado.direcao === 'asc' ? 'desc' : 'asc';
    atualizar({ ...estado, ordenar: coluna.ordenar, direcao, pagina: 1 });
  }

  const pagina = lista.data;
  const colunaOrdenada = entidade.colunas.find((c) => c.ordenar && c.ordenar === estado.ordenar);
  const anuncioOrdem = colunaOrdenada
    ? `Ordenado por ${colunaOrdenada.rotulo}, ordem ${ROTULO_DIRECAO[estado.direcao]}.`
    : '';
  const anuncio = pagina ? `${textoTotal(entidade, pagina.meta.total)}. ${anuncioOrdem}` : '';
  const filtrando = temFiltroAtivo(estado);

  return (
    <div className="flex flex-col gap-6">
      <NavegacaoCadastros atual={entidade.slug} />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-pagina font-semibold">{entidade.titulo}</h1>
        <Permitido permissao="cadastros:criar">
          <Link href={`/cadastros/${entidade.slug}/novo`} className={classesBotao.primario}>
            {entidade.rotuloNovo}
          </Link>
        </Permitido>
      </header>

      <form
        role="search"
        aria-label={`Filtrar ${entidade.plural}`}
        onSubmit={buscar}
        className="flex flex-col gap-4 rounded-lg border border-borda-suave p-4 md:flex-row md:flex-wrap md:items-end"
      >
        <div className="flex flex-col gap-1 md:min-w-72 md:flex-1">
          <label htmlFor={`${prefixo}-busca`} className="font-medium">
            {entidade.rotuloBusca}
          </label>
          <div className="flex gap-2">
            <input
              id={`${prefixo}-busca`}
              type="search"
              value={buscaDigitada}
              onChange={(e) => setBuscaDigitada(e.target.value)}
              className={`${classeCampo} min-w-0 flex-1`}
            />
            <Button type="submit" variante="secundario">
              Buscar
            </Button>
          </div>
        </div>
        {entidade.filtros.map((filtro) => (
          <CampoFiltro
            key={filtro.parametro}
            id={`${prefixo}-${filtro.parametro}`}
            filtro={filtro}
            valor={estado.filtros[filtro.parametro] ?? ''}
            onChange={(valor) => filtrar(filtro.parametro, valor)}
          />
        ))}
        {filtrando && (
          <Button variante="secundario" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        )}
      </form>

      <p role="status" aria-live="polite" aria-label="Resultado da lista" className="sr-only">
        {anuncio}
      </p>

      {lista.isPending ? (
        <EstadoCarregando linhas={5} rotulo={`Carregando ${entidade.plural}`} />
      ) : lista.isError && !pagina ? (
        lista.error instanceof ErroApi && lista.error.status === 403 ? (
          <EstadoSemPermissao />
        ) : (
          <EstadoErro
            mensagem={`Não foi possível carregar ${entidade.plural}. Verifique a conexão e tente novamente.`}
            onTentarNovamente={() => void lista.refetch()}
          />
        )
      ) : pagina && pagina.dados.length === 0 ? (
        filtrando ? (
          <EstadoVazio
            titulo={textoNenhum(entidade, 'encontrad', ' com esses filtros')}
            descricao="Revise a busca e os filtros, ou limpe-os para ver todos os registros."
            acao={
              <Button variante="secundario" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EstadoVazio
            titulo={textoNenhum(entidade, 'cadastrad')}
            acao={
              <Permitido permissao="cadastros:criar">
                <Link href={`/cadastros/${entidade.slug}/novo`} className={classesBotao.primario}>
                  {entidade.rotuloNovo}
                </Link>
              </Permitido>
            }
          />
        )
      ) : pagina ? (
        <>
          <Tabela
            entidade={entidade}
            registros={pagina.dados}
            estado={estado}
            onOrdenar={ordenar}
            acoes={(r) => (
              <Acoes
                entidade={entidade}
                registro={r}
                podeEscrever={podeEscrever}
                onDetalhes={setDetalhe}
                onExcluir={setAExcluir}
              />
            )}
          />
          <Cartoes
            entidade={entidade}
            registros={pagina.dados}
            acoes={(r) => (
              <Acoes
                entidade={entidade}
                registro={r}
                podeEscrever={podeEscrever}
                onDetalhes={setDetalhe}
                onExcluir={setAExcluir}
              />
            )}
          />
          <Paginacao
            pagina={pagina.meta}
            onIr={(numero) => atualizar({ ...estado, pagina: numero })}
          />
        </>
      ) : null}

      <Modal
        aberto={detalhe !== null}
        onAbertoChange={(aberto) => !aberto && setDetalhe(null)}
        titulo={detalhe ? nome(detalhe) : ''}
        descricao={`Dados do cadastro de ${entidade.singular}.`}
      >
        {detalhe && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
            {entidade.detalhes(detalhe).map(([rotulo, valor]) => (
              <div key={rotulo} className="contents">
                <dt className="font-medium">{rotulo}</dt>
                <dd className="text-texto-secundario">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      <ModalConfirmacao
        aberto={aExcluir !== null}
        onAbertoChange={(aberto) => !aberto && setAExcluir(null)}
        titulo={`Excluir ${entidade.singular}`}
        descricao={
          aExcluir
            ? `Excluir o cadastro de ${nome(aExcluir)}? Esta ação não pode ser desfeita.`
            : ''
        }
        rotuloConfirmar="Excluir"
        destrutiva
        onConfirmar={() => aExcluir && excluir.mutate(aExcluir)}
      />

      <Modal
        aberto={comVinculo !== null}
        onAbertoChange={(aberto) => !aberto && setComVinculo(null)}
        titulo="Não é possível excluir"
        descricao={comVinculo?.motivo}
      >
        <div className="flex justify-end gap-3">
          <Button variante="secundario" onClick={() => setComVinculo(null)}>
            Manter como está
          </Button>
          <Permitido permissao="cadastros:editar">
            <Button
              disabled={!podeEscrever || inativar.isPending}
              onClick={() => comVinculo && inativar.mutate(comVinculo.registro)}
            >
              Inativar
            </Button>
          </Permitido>
        </div>
      </Modal>
    </div>
  );
}

function mensagemDeErro(erro: unknown) {
  if (erro instanceof ErroApi && erro.detail) return erro.detail;
  return 'Não foi possível concluir a operação. Tente novamente.';
}

function CampoFiltro({
  id,
  filtro,
  valor,
  onChange,
}: {
  id: string;
  filtro: FiltroCadastro;
  valor: string;
  onChange: (valor: string) => void;
}) {
  const opcoes = useOpcoesFiltro(filtro);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {filtro.rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={classeCampo}
      >
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

function useOpcoesFiltro(filtro: FiltroCadastro): readonly OpcaoFiltro[] {
  const { cliente } = useSessao();
  const especialidades = useQuery({
    queryKey: ['cadastros', 'opcoes-especialidades'],
    queryFn: () => cliente.requisitar<Pagina<Especialidade>>('/especialidades?tamanho=100'),
    enabled: filtro.opcoes === 'especialidades',
    staleTime: 5 * 60_000,
  });
  if (filtro.opcoes !== 'especialidades') return filtro.opcoes;
  return (especialidades.data?.dados ?? []).map((e) => ({ valor: e.id, rotulo: e.nome }));
}

function Tabela({
  entidade,
  registros,
  estado,
  onOrdenar,
  acoes,
}: {
  entidade: Entidade;
  registros: RegistroCadastro[];
  estado: EstadoLista;
  onOrdenar: (coluna: Coluna) => void;
  acoes: (registro: RegistroCadastro) => ReactNode;
}) {
  const [primeira, ...demais] = entidade.colunas;
  const visibilidade = (c: Coluna) => (c.essencial ? '' : 'hidden xl:table-cell');

  function cabecalho(coluna: Coluna) {
    const ordenada = coluna.ordenar !== undefined && estado.ordenar === coluna.ordenar;
    const ariaSort = ordenada ? (estado.direcao === 'asc' ? 'ascending' : 'descending') : undefined;
    return (
      <th
        key={coluna.id}
        scope="col"
        aria-sort={coluna.ordenar ? (ariaSort ?? 'none') : undefined}
        className={`px-3 py-2 text-left font-semibold ${visibilidade(coluna)}`}
      >
        {coluna.ordenar ? (
          <button
            type="button"
            onClick={() => onOrdenar(coluna)}
            className="inline-flex min-h-toque items-center gap-1 rounded hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
          >
            {coluna.rotulo}
            <span aria-hidden="true">
              {ordenada ? (estado.direcao === 'asc' ? '↑' : '↓') : '↕'}
            </span>
          </button>
        ) : (
          coluna.rotulo
        )}
      </th>
    );
  }

  return (
    <div className="hidden md:block">
      <table className="w-full border-collapse">
        <caption className="sr-only">{entidade.titulo}</caption>
        <thead className="border-b border-borda">
          <tr>
            {entidade.colunas.map(cabecalho)}
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id} className="border-b border-borda-suave">
              {primeira && (
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {primeira.valor(registro)}
                </th>
              )}
              {demais.map((coluna) => (
                <td key={coluna.id} className={`px-3 py-2 ${visibilidade(coluna)}`}>
                  {coluna.valor(registro)}
                </td>
              ))}
              <td className="px-3 py-2">{acoes(registro)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Abaixo de 768 px a tabela vira lista de cartões (T-03). */
function Cartoes({
  entidade,
  registros,
  acoes,
}: {
  entidade: Entidade;
  registros: RegistroCadastro[];
  acoes: (registro: RegistroCadastro) => ReactNode;
}) {
  const [primeira, ...demais] = entidade.colunas;
  return (
    <ul aria-label={entidade.titulo} className="flex flex-col gap-3 md:hidden">
      {registros.map((registro) => (
        <li
          key={registro.id}
          className="flex flex-col gap-2 rounded-lg border border-borda-suave p-4"
        >
          <p className="font-semibold break-words">{primeira?.valor(registro)}</p>
          <dl className="flex flex-col gap-1">
            {demais.map((coluna) => (
              <div key={coluna.id} className="flex flex-wrap gap-x-2">
                <dt className="text-texto-secundario">{coluna.rotulo}:</dt>
                <dd className="break-words">{coluna.valor(registro)}</dd>
              </div>
            ))}
          </dl>
          {acoes(registro)}
        </li>
      ))}
    </ul>
  );
}

function Acoes({
  entidade,
  registro,
  podeEscrever,
  onDetalhes,
  onExcluir,
}: {
  entidade: Entidade;
  registro: RegistroCadastro;
  podeEscrever: boolean;
  onDetalhes: (registro: RegistroCadastro) => void;
  onExcluir: (registro: RegistroCadastro) => void;
}) {
  const nome = entidade.nomeRegistro(registro);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variante="secundario"
        aria-label={`Detalhes de ${nome}`}
        onClick={() => onDetalhes(registro)}
      >
        Detalhes
      </Button>
      <Permitido permissao="cadastros:editar">
        <Link
          href={`/cadastros/${entidade.slug}/${registro.id}`}
          aria-label={`Editar ${nome}`}
          className={classesBotao.secundario}
        >
          Editar
        </Link>
      </Permitido>
      {/* Ação destrutiva sempre à direita (especificação de UI §3.3). */}
      <Permitido permissao="cadastros:excluir">
        <Button
          variante="destrutivo"
          aria-label={`Excluir ${nome}`}
          disabled={!podeEscrever}
          onClick={() => onExcluir(registro)}
        >
          Excluir
        </Button>
      </Permitido>
    </div>
  );
}
