'use client';

import { type StatusSenha } from '@filas/contracts';
import {
  classeCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  EtiquetaStatus,
  usePermissoes,
} from '@filas/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

import { Paginacao } from '@/components/paginacao';
import { ErroApi } from '@/lib/api/cliente-http';
import { criarAtendimentoApi } from '@/lib/atendimento/api';
import { duracaoTexto } from '@/lib/atendimento/estado';
import { useSessao } from '@/lib/sessao/sessao';

export const FILTROS_ATENDIMENTO = {
  ativos: { rotulo: 'Em curso', status: ['EM_ATENDIMENTO', 'PAUSADO', 'PENDENTE_VALIDACAO'] },
  em_atendimento: { rotulo: 'Em atendimento', status: ['EM_ATENDIMENTO'] },
  pausado: { rotulo: 'Pausados', status: ['PAUSADO'] },
  pendente_validacao: { rotulo: 'Pendentes de validação', status: ['PENDENTE_VALIDACAO'] },
  encerrado: { rotulo: 'Encerrados', status: ['ENCERRADO'] },
} satisfies Record<string, { rotulo: string; status: StatusSenha[] }>;

export type FiltroAtendimento = keyof typeof FILTROS_ATENDIMENTO;

/** Atendimentos da unidade (projeção resumida, sem triagem nem observações, P-03). */
export function ListaAtendimentos({ filtroInicial }: { filtroInicial: FiltroAtendimento }) {
  const { tem } = usePermissoes();
  if (!tem('atendimento:consultar')) return <EstadoSemPermissao />;
  return <Lista filtroInicial={filtroInicial} />;
}

function Lista({ filtroInicial }: { filtroInicial: FiltroAtendimento }) {
  const id = useId();
  const { cliente } = useSessao();
  const api = useMemo(() => criarAtendimentoApi(cliente), [cliente]);
  const [filtro, setFiltro] = useState<FiltroAtendimento>(filtroInicial);
  const [pagina, setPagina] = useState(1);

  const lista = useQuery({
    queryKey: ['atendimentos', filtro, pagina],
    queryFn: () => api.listar({ status: FILTROS_ATENDIMENTO[filtro].status, pagina }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-pagina font-semibold">Atendimentos</h1>
        <p className="text-texto-secundario">
          Para iniciar um atendimento, abra a senha alocada no painel de fila.
        </p>
      </header>

      <div className="flex flex-col gap-1 md:max-w-xs">
        <label htmlFor={`${id}-filtro`} className="font-medium">
          Situação
        </label>
        <select
          id={`${id}-filtro`}
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value as FiltroAtendimento);
            setPagina(1);
          }}
          className={classeCampo}
        >
          {(Object.keys(FILTROS_ATENDIMENTO) as FiltroAtendimento[]).map((chave) => (
            <option key={chave} value={chave}>
              {FILTROS_ATENDIMENTO[chave].rotulo}
            </option>
          ))}
        </select>
      </div>

      {lista.isPending ? (
        <EstadoCarregando linhas={4} rotulo="Carregando os atendimentos" />
      ) : lista.error ? (
        lista.error instanceof ErroApi && lista.error.status === 403 ? (
          <EstadoSemPermissao />
        ) : (
          <EstadoErro
            mensagem="Não foi possível carregar os atendimentos. Verifique a conexão e tente novamente."
            onTentarNovamente={() => void lista.refetch()}
          />
        )
      ) : lista.data.dados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum atendimento nesta situação"
          descricao="Escolha outra situação ou volte ao painel de fila."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Atendimentos {FILTROS_ATENDIMENTO[filtro].rotulo.toLocaleLowerCase('pt-BR')}, do
                início mais recente para o mais antigo
              </caption>
              <thead className="border-b border-borda">
                <tr>
                  {['Senha', 'Paciente', 'Especialidade', 'Estudante', 'Duração', 'Situação'].map(
                    (coluna) => (
                      <th key={coluna} scope="col" className="px-3 py-2 text-left font-semibold">
                        {coluna}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {lista.data.dados.map((a) => (
                  <tr key={a.id} className="border-b border-borda-suave">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      <Link
                        href={`/atendimento?senha=${encodeURIComponent(a.senhaId)}`}
                        className="text-informacao underline"
                      >
                        {a.numero}
                      </Link>
                    </th>
                    <td className="px-3 py-2">{a.pacienteIniciais}</td>
                    <td className="px-3 py-2">{a.especialidade}</td>
                    <td className="px-3 py-2">{a.estudante}</td>
                    <td className="px-3 py-2">{duracaoTexto(a.duracaoMinutos)}</td>
                    <td className="px-3 py-2">
                      <EtiquetaStatus status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={lista.data.meta} onIr={setPagina} />
        </>
      )}
    </div>
  );
}
