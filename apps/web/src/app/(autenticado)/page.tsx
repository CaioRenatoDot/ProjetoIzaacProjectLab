import { classesBotao, EstadoSemPermissao, EstadoVazio } from '@filas/ui';
import Link from 'next/link';

import { montarHome, rotuloIndicador } from '@/lib/home';
import { obterSessao } from '@/lib/sessao';

const classeAcaoPrimaria = classesBotao.primario;

/**
 * Home por perfil (W-02 / T-02). Os blocos vêm das permissões da sessão (`lib/home.ts`).
 * Enquanto as APIs dos blocos não existem, cada bloco mostra o estado vazio.
 */
export default async function Home() {
  const sessao = await obterSessao();
  const { blocos, indicadores } = montarHome(sessao.permissoes);
  const [principal, ...laterais] = blocos;

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
          {indicadores.map((indicador) => (
            <li key={indicador.rota}>
              <Link
                href={indicador.rota}
                aria-label={rotuloIndicador(indicador, null)}
                className="flex h-full flex-col gap-1 rounded-lg border border-borda-suave p-4 hover:bg-superficie-elevada focus-visible:outline-2 focus-visible:outline-primaria"
              >
                <span className="text-texto-secundario">{indicador.rotulo}</span>
                <span className="text-pagina font-semibold">—</span>
                <span className="text-secundario text-texto-secundario">sem dados no momento</span>
              </Link>
            </li>
          ))}
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
            <EstadoVazio
              titulo={principal.vazio}
              acao={
                principal.acao && (
                  <Link href={principal.acao.rota} className={classeAcaoPrimaria}>
                    {principal.acao.rotulo}
                  </Link>
                )
              }
            />
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
                  <p className="text-texto-secundario">{bloco.vazio}</p>
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
