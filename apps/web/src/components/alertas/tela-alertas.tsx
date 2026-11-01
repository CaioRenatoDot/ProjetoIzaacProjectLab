'use client';

import {
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import {
  anunciarMudancas,
  compararLeituras,
  descreverGravidade,
  formatarHorario,
  ordenarParaExibicao,
  ROTULO_TIPO,
} from '@/lib/alertas/apresentacao';
import { type AcaoEscalonamento, type Alerta } from '@/lib/alertas/tipos';
import { type Pagina } from '@/lib/cadastros/tipos';
import { useSessao } from '@/lib/sessao/sessao';

import { Paginacao } from '../paginacao';
import { CartaoAlerta, idTituloAlerta } from './cartao-alerta';
import { ModalEscalonamento, type PedidoEscalonamento } from './modal-escalonamento';

/** Sem o canal `/alertas` conectado, a tela revalida por HTTP a cada 30 s (`docs/04` §7). */
export const REVALIDACAO_MS = 30_000;

const CHAVE_ABERTOS = ['alertas', 'abertos'] as const;
const CONSULTA_ABERTOS = '/alertas?status=ATIVO&status=RECONHECIDO&pagina=1&tamanho=100';

/** W-18 / T-17: alertas de SLA e escalonamento. Supervisor consulta sem as ações. */
export function TelaAlertas() {
  const { tem } = usePermissoes();
  if (!tem('alertas:consultar')) return <EstadoSemPermissao />;
  return <Alertas />;
}

function Alertas() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const mostrarToast = useToast();
  const { podeEscrever } = useConexao();
  const [anuncio, setAnuncio] = useState('');
  const [pedido, setPedido] = useState<PedidoEscalonamento | null>(null);
  const [paginaHistorico, setPaginaHistorico] = useState(1);

  const abertos = useQuery({
    queryKey: CHAVE_ABERTOS,
    queryFn: async () => {
      const anterior = queryClient.getQueryData<Pagina<Alerta>>(CHAVE_ABERTOS);
      const atual = await cliente.requisitar<Pagina<Alerta>>(CONSULTA_ABERTOS);
      if (anterior) {
        const mudancas = compararLeituras(anterior.dados, atual.dados);
        const texto = anunciarMudancas(mudancas);
        if (texto) setAnuncio(texto);
        if (mudancas.normalizados.length > 0) {
          void queryClient.invalidateQueries({ queryKey: ['alertas', 'historico'] });
        }
      }
      return atual;
    },
    refetchInterval: REVALIDACAO_MS,
  });

  const historico = useQuery({
    queryKey: ['alertas', 'historico', paginaHistorico],
    queryFn: () =>
      cliente.requisitar<Pagina<Alerta>>(
        `/alertas?status=NORMALIZADO&pagina=${paginaHistorico}&tamanho=20`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: REVALIDACAO_MS,
  });

  const reconhecer = useMutation({
    mutationFn: (alerta: Alerta) =>
      cliente.requisitar<Alerta>(`/alertas/${alerta.id}/reconhecimento`, { metodo: 'POST' }),
    onSuccess: (atualizado) => {
      queryClient.setQueryData<Pagina<Alerta>>(CHAVE_ABERTOS, (pagina) =>
        pagina
          ? { ...pagina, dados: pagina.dados.map((a) => (a.id === atualizado.id ? atualizado : a)) }
          : pagina,
      );
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `Alerta de ${atualizado.especialidade} reconhecido. Ele continua na lista até a espera voltar ao limite.`,
      });
      // O botão some com o reconhecimento: o foco acompanha o alerta, que desce na lista.
      requestAnimationFrame(() => document.getElementById(idTituloAlerta(atualizado))?.focus());
      void queryClient.invalidateQueries({ queryKey: CHAVE_ABERTOS });
    },
    onError: (erro) =>
      mostrarToast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi && erro.status === 403
            ? 'Seu perfil não tem permissão para reconhecer alertas.'
            : 'Não foi possível reconhecer o alerta. Verifique a conexão e tente novamente.',
      }),
  });

  const escalonar = (alerta: Alerta, acao: AcaoEscalonamento) => setPedido({ alerta, acao });
  const lista = abertos.data ? ordenarParaExibicao(abertos.data.dados) : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-pagina font-semibold">Alertas de SLA</h1>
        <p className="text-texto-secundario">
          Filas com espera acima do limite e filas bloqueadas por falta de supervisor. A lista se
          atualiza sozinha.
        </p>
      </header>

      <p role="status" aria-live="polite" aria-label="Avisos de alertas" className="sr-only">
        {anuncio}
      </p>

      <section aria-labelledby="alertas-abertos" className="flex flex-col gap-4">
        <h2 id="alertas-abertos" className="text-secao font-semibold">
          Alertas em aberto
        </h2>
        {abertos.isPending ? (
          <EstadoCarregando linhas={4} rotulo="Carregando os alertas" />
        ) : abertos.isError && !abertos.data ? (
          abertos.error instanceof ErroApi && abertos.error.status === 403 ? (
            <EstadoSemPermissao />
          ) : (
            <EstadoErro
              mensagem="Não foi possível carregar os alertas. Verifique a conexão e tente novamente."
              onTentarNovamente={() => void abertos.refetch()}
            />
          )
        ) : lista.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum alerta ativo"
            descricao="Todas as filas estão dentro do limite de espera e sem bloqueio. O histórico continua disponível abaixo."
          />
        ) : (
          <ul aria-label="Alertas em aberto" className="flex flex-col gap-4">
            {lista.map((alerta) => (
              <CartaoAlerta
                key={alerta.id}
                alerta={alerta}
                podeEscrever={podeEscrever}
                reconhecendo={reconhecer.isPending && reconhecer.variables.id === alerta.id}
                onReconhecer={(a) => reconhecer.mutate(a)}
                onEscalonar={escalonar}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="alertas-historico" className="flex flex-col gap-4">
        <h2 id="alertas-historico" className="text-secao font-semibold">
          Histórico de alertas
        </h2>
        {historico.isPending ? (
          <EstadoCarregando linhas={4} rotulo="Carregando o histórico de alertas" />
        ) : historico.isError && !historico.data ? (
          <EstadoErro
            mensagem="Não foi possível carregar o histórico. Verifique a conexão e tente novamente."
            onTentarNovamente={() => void historico.refetch()}
          />
        ) : historico.data.dados.length === 0 ? (
          <EstadoVazio titulo="Nenhum alerta normalizado no histórico" />
        ) : (
          <>
            <Historico alertas={historico.data.dados} />
            <Paginacao pagina={historico.data.meta} onIr={setPaginaHistorico} />
          </>
        )}
      </section>

      <ModalEscalonamento pedido={pedido} onFechar={() => setPedido(null)} />
    </div>
  );
}

function Historico({ alertas }: { alertas: Alerta[] }) {
  return (
    <>
      <table className="hidden w-full border-collapse md:table">
        <caption className="sr-only">Histórico de alertas normalizados</caption>
        <thead className="border-b border-borda">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Especialidade
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Origem
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Situação no disparo
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Disparado em
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Normalizado em
            </th>
          </tr>
        </thead>
        <tbody>
          {alertas.map((a) => (
            <tr key={a.id} className="border-b border-borda-suave">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {a.especialidade}
              </th>
              <td className="px-3 py-2">{ROTULO_TIPO[a.tipo]}</td>
              <td className="px-3 py-2">{descreverGravidade(a)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatarHorario(a.disparadoEm)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {a.normalizadoEm ? formatarHorario(a.normalizadoEm) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Coluna única abaixo de 768 px (T-17). */}
      <ul aria-label="Histórico de alertas normalizados" className="flex flex-col gap-3 md:hidden">
        {alertas.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 rounded-lg border border-borda-suave p-4">
            <p className="font-semibold">
              {a.especialidade} · {ROTULO_TIPO[a.tipo]}
            </p>
            <p className="text-texto-secundario">{descreverGravidade(a)}</p>
            <p className="text-texto-secundario">
              Disparado em {formatarHorario(a.disparadoEm)}
              {a.normalizadoEm ? `, normalizado em ${formatarHorario(a.normalizadoEm)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
