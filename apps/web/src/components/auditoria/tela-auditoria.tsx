'use client';

import {
  Button,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  Permitido,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { baixarArquivo } from '@/lib/arquivo';
import {
  type EstadoAuditoria,
  type FiltrosAuditoria,
  FILTROS_VAZIOS,
  formatarDataHora,
  lerEstadoSalvo,
  montarConsulta,
  montarConsultaExportacao,
  nomeArquivoExportacao,
  ROTULO_OPERACAO,
  rotuloModulo,
  salvarEstado,
  temFiltroAtivo,
} from '@/lib/auditoria/consulta';
import { type EventoAuditoria } from '@/lib/auditoria/tipos';
import { type Pagina } from '@/lib/cadastros/tipos';
import { useSessao } from '@/lib/sessao/sessao';

import { Paginacao } from '../paginacao';
import { DetalheEvento } from './detalhe-evento';
import { FiltrosAuditoriaForm } from './filtros-auditoria';
import { MarcaSensivel } from './marca-sensivel';

const ORDENACAO = 'Ordenados por data e hora, do mais recente para o mais antigo.';

/** W-18 / T-18: trilha de auditoria, somente leitura e não oferecida abaixo de 768 px. */
export function TelaAuditoria() {
  const { tem } = usePermissoes();
  if (!tem('auditoria:consultar')) return <EstadoSemPermissao />;
  return (
    <>
      <div className="flex flex-col gap-2 py-10 text-center md:hidden">
        <p className="text-secao font-semibold">Trilha de auditoria indisponível nesta tela</p>
        <p className="text-texto-secundario">
          A trilha de auditoria não é oferecida em telas com menos de 768 px de largura. Abra-a em
          um computador ou tablet.
        </p>
      </div>
      <div className="hidden md:block">
        <Trilha />
      </div>
    </>
  );
}

function Trilha() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const [estado, setEstadoLocal] = useState<EstadoAuditoria>(lerEstadoSalvo);
  const [selecionado, setSelecionado] = useState<EventoAuditoria | null>(null);
  // Troca quando os filtros mudam por fora do formulário, para o rascunho recomeçar.
  const [versaoFiltros, setVersaoFiltros] = useState(0);

  function atualizar(novo: EstadoAuditoria) {
    salvarEstado(novo);
    setEstadoLocal(novo);
  }

  const aplicar = (filtros: FiltrosAuditoria) => atualizar({ filtros, pagina: 1 });

  function limparFiltros() {
    aplicar(FILTROS_VAZIOS);
    setVersaoFiltros((v) => v + 1);
  }

  function filtrarRegistro(entidadeId: string) {
    setSelecionado(null);
    aplicar({ ...FILTROS_VAZIOS, entidadeId });
    setVersaoFiltros((v) => v + 1);
  }

  const consulta = montarConsulta(estado);
  const lista = useQuery({
    queryKey: ['auditoria', 'trilha', consulta],
    queryFn: () => cliente.requisitar<Pagina<EventoAuditoria>>(`/auditoria${consulta}`),
    placeholderData: keepPreviousData,
  });

  const exportar = useMutation({
    mutationFn: () =>
      cliente.requisitar<Blob>(`/auditoria/exportacao${montarConsultaExportacao(estado.filtros)}`, {
        resposta: 'blob',
      }),
    onSuccess: (arquivo) => {
      baixarArquivo(arquivo, nomeArquivoExportacao(new Date()));
      mostrarToast({
        tipo: 'sucesso',
        mensagem: 'Exportação concluída. A própria exportação foi registrada na trilha.',
      });
      // A exportação gera um evento novo: a primeira página muda.
      void queryClient.invalidateQueries({ queryKey: ['auditoria', 'trilha'] });
    },
    onError: (erro) =>
      mostrarToast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi && erro.status === 403
            ? 'Seu perfil não tem permissão para exportar a trilha.'
            : 'Não foi possível exportar a trilha. Verifique a conexão e tente novamente.',
      }),
  });

  const pagina = lista.data;
  const filtrando = temFiltroAtivo(estado.filtros);
  const total = pagina?.meta.total ?? 0;
  const anuncio = pagina
    ? `${total === 1 ? '1 registro encontrado' : `${total} registros encontrados`}. ${ORDENACAO}`
    : '';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-pagina font-semibold">Trilha de auditoria</h1>
        <Permitido permissao="auditoria:exportar">
          <Button
            variante="secundario"
            disabled={exportar.isPending || total === 0}
            onClick={() => exportar.mutate()}
          >
            {exportar.isPending ? 'Exportando…' : 'Exportar resultado'}
          </Button>
        </Permitido>
      </header>

      <FiltrosAuditoriaForm key={versaoFiltros} aplicados={estado.filtros} onAplicar={aplicar} />

      <p role="status" aria-live="polite" aria-label="Resultado da trilha" className="sr-only">
        {anuncio}
      </p>

      {lista.isPending ? (
        <EstadoCarregando linhas={6} rotulo="Carregando a trilha de auditoria" />
      ) : lista.isError && !pagina ? (
        lista.error instanceof ErroApi && lista.error.status === 403 ? (
          <EstadoSemPermissao />
        ) : (
          <EstadoErro
            mensagem="Não foi possível carregar a trilha de auditoria. Verifique a conexão e tente novamente."
            onTentarNovamente={() => void lista.refetch()}
          />
        )
      ) : pagina && pagina.dados.length === 0 ? (
        filtrando ? (
          <EstadoVazio
            titulo="Nenhum registro encontrado com esses filtros"
            descricao="Revise o período e os demais filtros, ou limpe-os para ver toda a trilha."
            acao={
              <Button variante="secundario" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EstadoVazio titulo="Nenhum registro de auditoria até o momento" />
        )
      ) : pagina ? (
        <>
          <Tabela eventos={pagina.dados} onDetalhes={setSelecionado} />
          <p className="flex flex-wrap items-center gap-2 text-secundario text-texto-secundario">
            <MarcaSensivel />
            indica consulta a dado de prontuário (RNF-07). Registros de auditoria são somente
            leitura.
          </p>
          <Paginacao
            pagina={pagina.meta}
            onIr={(numero) => atualizar({ ...estado, pagina: numero })}
          />
        </>
      ) : null}

      <DetalheEvento
        evento={selecionado}
        onFechar={() => setSelecionado(null)}
        onFiltrarRegistro={filtrarRegistro}
      />
    </div>
  );
}

function Tabela({
  eventos,
  onDetalhes,
}: {
  eventos: EventoAuditoria[];
  onDetalhes: (evento: EventoAuditoria) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Trilha de auditoria. {ORDENACAO}</caption>
      <thead className="border-b border-borda">
        <tr>
          <th scope="col" aria-sort="descending" className="px-3 py-2 text-left font-semibold">
            Data e hora <span aria-hidden="true">↓</span>
          </th>
          <th scope="col" className="px-3 py-2 text-left font-semibold">
            Usuário
          </th>
          <th scope="col" className="px-3 py-2 text-left font-semibold">
            Operação
          </th>
          <th scope="col" className="hidden px-3 py-2 text-left font-semibold xl:table-cell">
            Módulo
          </th>
          <th scope="col" className="px-3 py-2 text-left font-semibold">
            Registro
          </th>
          <th scope="col" className="px-3 py-2 text-left font-semibold">
            Ações
          </th>
        </tr>
      </thead>
      <tbody>
        {eventos.map((evento) => {
          const quando = formatarDataHora(evento.ocorridoEm);
          return (
            <tr
              key={evento.id}
              data-sensivel={evento.sensivel || undefined}
              className={`border-b border-borda-suave ${evento.sensivel ? 'border-l-4 border-l-purple-700 bg-purple-50' : ''}`}
            >
              <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {quando}
              </th>
              <td className="px-3 py-2">
                <span className="block">{evento.usuarioNome}</span>
                <span className="block text-secundario text-texto-secundario">
                  {evento.perfilNoMomento}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{ROTULO_OPERACAO[evento.operacao]}</span>
                  {evento.sensivel && <MarcaSensivel />}
                </span>
                <span className="block text-secundario text-texto-secundario">
                  {evento.descricao}
                </span>
              </td>
              <td className="hidden px-3 py-2 xl:table-cell">{rotuloModulo(evento.modulo)}</td>
              <td className="px-3 py-2">
                {evento.entidadeId ? (
                  <span title={evento.entidadeId}>
                    {evento.entidade}{' '}
                    <span className="font-mono">{evento.entidadeId.slice(0, 8)}</span>
                  </span>
                ) : (
                  <span className="text-texto-secundario">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Button
                  variante="secundario"
                  aria-label={`Detalhes do evento de ${quando}`}
                  onClick={() => onDetalhes(evento)}
                >
                  Detalhes
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
