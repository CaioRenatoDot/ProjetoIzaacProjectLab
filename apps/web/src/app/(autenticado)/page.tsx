'use client';

import {
  classesBotao,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
} from '@filas/ui';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useMemo } from 'react';

import { type BlocoHome, montarHome, rotuloIndicador, unidadeDoIndicador } from '@/lib/home';
import {
  criarFontesHome,
  type DadosFonte,
  FONTES,
  type FonteHome,
  type ItemHome,
  PERMISSAO_FONTE,
} from '@/lib/home-fontes';
import { useSessao, useUsuario } from '@/lib/sessao/sessao';

const classeAcaoPrimaria = classesBotao.primario;

/** Sem canal de tempo real na home: os números revalidam como nas demais telas (`docs/04` §7). */
const REVALIDACAO_MS = 30_000;

type ConsultasHome = Readonly<Record<FonteHome, UseQueryResult<DadosFonte>>>;

function useConsultasHome(permissoes: readonly string[]): ConsultasHome {
  const { cliente } = useSessao();
  const fontes = useMemo(() => criarFontesHome(cliente), [cliente]);
  const resultados = useQueries({
    queries: FONTES.map((fonte) => ({
      queryKey: ['home', fonte],
      queryFn: fontes[fonte],
      enabled: permissoes.includes(PERMISSAO_FONTE[fonte]),
      refetchInterval: REVALIDACAO_MS,
    })),
  });
  return Object.fromEntries(
    FONTES.map((fonte, i) => [fonte, resultados[i]]),
  ) as unknown as ConsultasHome;
}

/** Home por perfil (W-02 / T-02). Os blocos vêm das permissões da sessão (`lib/home.ts`). */
export default function Home() {
  const sessao = useUsuario();
  const { blocos, indicadores } = montarHome(sessao.permissoes);
  const consultas = useConsultasHome(sessao.permissoes);
  const [principal, ...laterais] = blocos;

  /** O estado vazio já traz a própria ação; nos demais estados, ela vem depois do conteúdo. */
  const conteudoDe = (bloco: BlocoHome, vazio: ReactNode, acao?: ReactNode) => {
    if (!bloco.fonte) return vazio;
    const consulta = consultas[bloco.fonte];
    const permitida = sessao.permissoes.includes(PERMISSAO_FONTE[bloco.fonte]);
    if (permitida && consulta.data?.itens.length === 0) return vazio;
    return (
      <>
        {!permitida ? (
          <p className="text-texto-secundario">Seu perfil não consulta estes dados.</p>
        ) : consulta.isPending ? (
          <EstadoCarregando linhas={3} rotulo={`Carregando ${bloco.titulo}`} />
        ) : !consulta.data ? (
          <EstadoErro
            mensagem={`Não foi possível carregar "${bloco.titulo}". Verifique a conexão e tente novamente.`}
            onTentarNovamente={() => void consulta.refetch()}
          />
        ) : (
          <>
            <ListaBloco titulo={bloco.titulo} itens={consulta.data.itens} />
            {consulta.data.restantes > 0 && (
              <p className="text-secundario text-texto-secundario">
                E mais {consulta.data.restantes} no módulo.
              </p>
            )}
          </>
        )}
        {acao}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="saudacao" className="rounded-lg bg-superficie-elevada p-6">
        <h1 id="saudacao" className="text-pagina font-semibold">
          Olá, {sessao.nome}
        </h1>
        <p className="text-texto-secundario">Perfil ativo: {sessao.perfilNome}</p>
      </section>

      {indicadores.length > 0 && (
        <ul
          aria-label="Indicadores"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {indicadores.map((indicador) => {
            const consulta = consultas[indicador.fonte];
            const valor = consulta.data?.total ?? null;
            return (
              <li key={indicador.rota}>
                <Link
                  href={indicador.rota}
                  aria-label={rotuloIndicador(indicador, valor)}
                  className="flex h-full flex-col gap-1 rounded-lg border border-borda-suave p-4 hover:bg-superficie-elevada focus-visible:outline-2 focus-visible:outline-primaria"
                >
                  <span className="text-texto-secundario">{indicador.rotulo}</span>
                  <span className="text-pagina font-semibold">
                    {consulta.isPending ? '…' : (valor ?? '—')}
                  </span>
                  <span className="text-secundario text-texto-secundario">
                    {consulta.isPending
                      ? 'carregando'
                      : valor === null
                        ? 'sem dados no momento'
                        : unidadeDoIndicador(indicador, valor)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!principal ? (
        <EstadoSemPermissao />
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          <section
            aria-labelledby={`bloco-${principal.id}`}
            className="flex flex-col gap-4 rounded-lg border border-borda-suave p-6 md:flex-[2]"
          >
            <h2 id={`bloco-${principal.id}`} className="text-secao font-semibold">
              {principal.titulo}
            </h2>
            {conteudoDe(
              principal,
              <EstadoVazio
                titulo={principal.vazio}
                acao={
                  principal.acao && (
                    <Link href={principal.acao.rota} className={classeAcaoPrimaria}>
                      {principal.acao.rotulo}
                    </Link>
                  )
                }
              />,
              principal.acao && (
                <Link href={principal.acao.rota} className={`${classeAcaoPrimaria} self-start`}>
                  {principal.acao.rotulo}
                </Link>
              ),
            )}
          </section>
          {laterais.length > 0 && (
            <aside className="flex flex-col gap-4 md:flex-1">
              {laterais.map((bloco) => (
                <section
                  key={bloco.id}
                  aria-labelledby={`bloco-${bloco.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-borda-suave p-4"
                >
                  <h2 id={`bloco-${bloco.id}`} className="text-secao font-semibold">
                    {bloco.titulo}
                  </h2>
                  {conteudoDe(bloco, <p className="text-texto-secundario">{bloco.vazio}</p>)}
                  {bloco.acao && (
                    <Link href={bloco.acao.rota} className={`${classeAcaoPrimaria} self-start`}>
                      {bloco.acao.rotulo}
                    </Link>
                  )}
                </section>
              ))}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function ListaBloco({ titulo, itens }: { titulo: string; itens: readonly ItemHome[] }) {
  return (
    <ul aria-label={titulo} className="flex flex-col gap-1">
      {itens.map((item) => (
        <li key={item.id}>
          <Link
            href={item.rota}
            className="flex min-h-toque flex-col justify-center rounded-md px-2 py-1 hover:bg-superficie-elevada focus-visible:outline-2 focus-visible:outline-primaria"
          >
            <span className="font-medium">{item.titulo}</span>
            <span className="text-secundario text-texto-secundario">{item.detalhe}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
