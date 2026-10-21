import { EstadoSemPermissao, EstadoVazio } from '@filas/ui';
import Link from 'next/link';

import { montarHome, rotuloIndicador } from '@/lib/home';
import { obterSessaoProvisoria } from '@/lib/sessao';

const classeAcaoPrimaria =
  'inline-block rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700';

/**
 * Home por perfil (W-02 / T-02). Os blocos vêm das permissões da sessão (`lib/home.ts`).
 * Enquanto as APIs dos blocos não existem, cada bloco mostra o estado vazio.
 */
export default function Home() {
  const sessao = obterSessaoProvisoria();
  const { blocos, indicadores } = montarHome(sessao.permissoes);
  const [principal, ...laterais] = blocos;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="saudacao" className="rounded-lg bg-slate-100 p-6">
        <h1 id="saudacao" className="text-2xl font-semibold">
          Olá, {sessao.nome}
        </h1>
        <p className="text-slate-700">Perfil ativo: {sessao.perfilNome}</p>
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
                className="flex h-full flex-col gap-1 rounded-lg border border-slate-300 p-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900"
              >
                <span className="text-slate-700">{indicador.rotulo}</span>
                <span className="text-3xl font-semibold">—</span>
                <span className="text-sm text-slate-700">sem dados no momento</span>
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
            className="flex flex-col gap-4 rounded-lg border border-slate-300 p-6 md:flex-[2]"
          >
            <h2 id={`bloco-${principal.id}`} className="text-xl font-semibold">
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
                  className="flex flex-col gap-2 rounded-lg border border-slate-300 p-4"
                >
                  <h2 id={`bloco-${bloco.id}`} className="text-lg font-semibold">
                    {bloco.titulo}
                  </h2>
                  <p className="text-slate-700">{bloco.vazio}</p>
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
